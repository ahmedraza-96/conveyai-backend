import mongoose from "mongoose";
import logger from "../../lib/logger.service";
import {
	callLLM,
	callLLMChat,
	streamLLMChat,
} from "../../lib/llm.service";
import { getUserById } from "../user/user.services";
import {
	extractResumeText,
	fetchResumeBuffer,
} from "../interview-preparation/resume-parser";
import { computeAdaptiveContext } from "../voice-interview/adaptive-engine";
import VoiceInterviewModel from "../voice-interview/voice-interview.model";
import { VOICE_INTERVIEW_STATUS } from "../voice-interview/voice-interview.constants";
import ChatSessionModel, { type ChatSessionDoc } from "./chat.model";
import ResumeAnalysisModel from "../resume-analysis/resume-analysis.model";
import { CHAT_LIMITS, CHAT_SESSION_STATUS } from "./chat.constants";

// ─── Context Building ────────────────────────────────────────────

const getResumeText = async (userId: string): Promise<string | null> => {
	try {
		const user = await getUserById(userId);
		if (!user?.resume) return null;

		const extension = user.resume.toLowerCase().split(".").pop();
		let text: string;
		if (extension === "pdf") {
			text = await extractResumeText(user.resume, Buffer.alloc(0), user.resume);
		} else {
			const buffer = await fetchResumeBuffer(user.resume);
			text = await extractResumeText(user.resume, buffer);
		}
		// Truncate to ~3000 chars
		return text.length > 3000 ? `${text.slice(0, 3000)}...` : text;
	} catch (error) {
		logger.warn({ userId, error }, "Failed to extract resume text for chat context");
		return null;
	}
};

const getJobDescription = async (userId: string): Promise<string | null> => {
	try {
		const user = await getUserById(userId);
		return user?.jobDescription || null;
	} catch {
		return null;
	}
};

const getInterviewSummaries = async (userId: string): Promise<string> => {
	try {
		const sessions = await VoiceInterviewModel.find({
			userId: new mongoose.Types.ObjectId(userId),
			status: VOICE_INTERVIEW_STATUS.COMPLETED,
			analysis: { $exists: true, $ne: null },
		})
			.sort({ createdAt: -1 })
			.limit(10)
			.lean()
			.exec();

		if (sessions.length === 0) return "No completed interviews yet.";

		return sessions
			.map((s, i) => {
				const a = s.analysis!;
				const strengths = a.strengths?.slice(0, 3).join(", ") || "N/A";
				const weaknesses = a.weaknesses?.slice(0, 3).join(", ") || "N/A";
				return `Interview ${i + 1} (${s.interviewType}, ${s.difficulty}): Score ${a.overallScore}/100. Strengths: ${strengths}. Weaknesses: ${weaknesses}.`;
			})
			.join("\n");
	} catch {
		return "Unable to fetch interview history.";
	}
};

const getResumeAnalysisSummary = async (
	userId: string,
): Promise<string | null> => {
	try {
		const analysis = await ResumeAnalysisModel.findOne({
			userId: new mongoose.Types.ObjectId(userId),
			status: "completed",
		})
			.sort({ createdAt: -1 })
			.lean()
			.exec();

		if (!analysis?.result) return null;

		const r = analysis.result as {
			overallScore?: number;
			atsCompatibilityScore?: number;
			keywordAnalysis?: { missingKeywords?: Array<{ keyword: string }> };
			improvements?: string[];
		};

		const missing =
			r.keywordAnalysis?.missingKeywords
				?.slice(0, 5)
				.map((k) => k.keyword)
				.join(", ") || "N/A";
		const improvements = r.improvements?.slice(0, 3).join("; ") || "N/A";

		return `ATS Score: ${r.atsCompatibilityScore ?? "N/A"}/100. Overall: ${r.overallScore ?? "N/A"}/100. Missing keywords: ${missing}. Top improvements: ${improvements}.`;
	} catch {
		return null;
	}
};

const buildSystemPrompt = async (userId: string): Promise<string> => {
	const [resumeText, jobDescription, interviewSummaries, adaptiveContext, resumeAnalysis] =
		await Promise.all([
			getResumeText(userId),
			getJobDescription(userId),
			getInterviewSummaries(userId),
			computeAdaptiveContext(userId),
			getResumeAnalysisSummary(userId),
		]);

	let systemPrompt = `You are an expert AI Interview Coach. You help users prepare for job interviews by providing personalized advice, practice questions, feedback, and study strategies.

Your personality: Encouraging but honest. You celebrate strengths while providing constructive feedback on weaknesses. You adapt to the user's level and goals.

Guidelines:
- Give specific, actionable advice based on the user's data
- When asked about interview performance, reference their actual scores and feedback
- Suggest targeted practice areas based on weak spots
- Offer mock interview questions when asked
- Keep responses focused and practical
- Use markdown formatting for clarity (bullet points, bold, headers)
- If you don't have enough data about the user, say so and ask them to complete more interviews or update their profile`;

	if (resumeText) {
		systemPrompt += `\n\n## User's Resume (Summary)\n${resumeText}`;
	}

	if (jobDescription) {
		systemPrompt += `\n\n## Target Job Description\n${jobDescription}`;
	}

	systemPrompt += `\n\n## Interview History\n${interviewSummaries}`;

	if (adaptiveContext) {
		systemPrompt += `\n\n## Performance Analysis`;
		if (adaptiveContext.weakAreas.length > 0) {
			systemPrompt += `\nWeak areas: ${adaptiveContext.weakAreas.join(", ")}`;
		}
		if (adaptiveContext.strongAreas.length > 0) {
			systemPrompt += `\nStrong areas: ${adaptiveContext.strongAreas.join(", ")}`;
		}
		if (adaptiveContext.commonWeaknesses.length > 0) {
			systemPrompt += `\nRecurring weaknesses: ${adaptiveContext.commonWeaknesses.join(", ")}`;
		}
		systemPrompt += `\nTrend: ${adaptiveContext.overallTrend}`;
		systemPrompt += `\nTotal completed interviews: ${adaptiveContext.totalCompletedInterviews}`;
	}

	if (resumeAnalysis) {
		systemPrompt += `\n\n## Resume Analysis\n${resumeAnalysis}`;
	}

	return systemPrompt;
};

// ─── CRUD Operations ─────────────────────────────────────────────

export const createSession = async (
	userId: string,
	title?: string,
): Promise<ChatSessionDoc> => {
	// Check session limit
	const count = await ChatSessionModel.countDocuments({
		userId: new mongoose.Types.ObjectId(userId),
	});

	if (count >= CHAT_LIMITS.MAX_SESSIONS_PER_USER) {
		throw new Error(
			`Maximum ${CHAT_LIMITS.MAX_SESSIONS_PER_USER} chat sessions allowed. Please delete old sessions.`,
		);
	}

	const session = await ChatSessionModel.create({
		userId: new mongoose.Types.ObjectId(userId),
		title: title || "New Chat",
	});

	return session;
};

export const getSessions = async (
	userId: string,
): Promise<ChatSessionDoc[]> => {
	return ChatSessionModel.find({
		userId: new mongoose.Types.ObjectId(userId),
	})
		.select("title status lastMessageAt createdAt updatedAt")
		.sort({ lastMessageAt: -1, createdAt: -1 })
		.lean()
		.exec() as unknown as ChatSessionDoc[];
};

export const getSessionById = async (
	sessionId: string,
	userId: string,
): Promise<ChatSessionDoc | null> => {
	return ChatSessionModel.findOne({
		_id: sessionId,
		userId: new mongoose.Types.ObjectId(userId),
	})
		.lean()
		.exec() as unknown as ChatSessionDoc | null;
};

export const updateSession = async (
	sessionId: string,
	userId: string,
	updates: { title?: string; status?: string },
): Promise<ChatSessionDoc | null> => {
	return ChatSessionModel.findOneAndUpdate(
		{
			_id: sessionId,
			userId: new mongoose.Types.ObjectId(userId),
		},
		{ $set: updates },
		{ new: true },
	)
		.lean()
		.exec() as unknown as ChatSessionDoc | null;
};

export const deleteSession = async (
	sessionId: string,
	userId: string,
): Promise<boolean> => {
	const result = await ChatSessionModel.deleteOne({
		_id: sessionId,
		userId: new mongoose.Types.ObjectId(userId),
	});
	return result.deletedCount > 0;
};

// ─── Send Message ────────────────────────────────────────────────

export const sendMessage = async (
	sessionId: string,
	userId: string,
	content: string,
): Promise<{ userMessage: { role: string; content: string; timestamp: Date }; assistantMessage: { role: string; content: string; timestamp: Date } }> => {
	const session = await ChatSessionModel.findOne({
		_id: sessionId,
		userId: new mongoose.Types.ObjectId(userId),
	});

	if (!session) {
		throw new Error("Session not found");
	}

	if (session.status === CHAT_SESSION_STATUS.ARCHIVED) {
		throw new Error("Cannot send messages to an archived session");
	}

	if (session.messages.length >= CHAT_LIMITS.MAX_MESSAGES_PER_SESSION) {
		throw new Error(
			`Session has reached the maximum of ${CHAT_LIMITS.MAX_MESSAGES_PER_SESSION} messages. Please start a new session.`,
		);
	}

	// Add user message
	const userMessage = {
		role: "user" as const,
		content,
		timestamp: new Date(),
	};
	session.messages.push(userMessage);

	// Build context and get AI response
	const systemPrompt = await buildSystemPrompt(userId);

	// Get recent messages for context (limit to avoid token overflow)
	const recentMessages = session.messages
		.slice(-CHAT_LIMITS.CONTEXT_MESSAGE_COUNT)
		.map((m) => ({ role: m.role, content: m.content }));

	const aiResponse = await callLLMChat(systemPrompt, recentMessages);

	// Add assistant message
	const assistantMessage = {
		role: "assistant" as const,
		content: aiResponse,
		timestamp: new Date(),
	};
	session.messages.push(assistantMessage);

	// Auto-generate title from first user message
	if (session.title === "New Chat" && session.messages.length <= 2) {
		try {
			const titlePrompt = `Generate a very short title (3-6 words, no quotes) for a chat that starts with: "${content.slice(0, 200)}"`;
			const title = await callLLM(titlePrompt);
			session.title = title.replace(/["']/g, "").trim().slice(0, 100);
		} catch {
			// Keep default title on failure
		}
	}

	session.lastMessageAt = new Date();
	await session.save();

	return { userMessage, assistantMessage };
};

// ─── Send Message with Streaming ─────────────────────────────────

export const sendMessageStream = async (
	sessionId: string,
	userId: string,
	content: string,
	onChunk: (text: string) => void,
): Promise<{ userMessage: { role: string; content: string; timestamp: Date }; assistantContent: string }> => {
	const session = await ChatSessionModel.findOne({
		_id: sessionId,
		userId: new mongoose.Types.ObjectId(userId),
	});

	if (!session) {
		throw new Error("Session not found");
	}

	if (session.status === CHAT_SESSION_STATUS.ARCHIVED) {
		throw new Error("Cannot send messages to an archived session");
	}

	if (session.messages.length >= CHAT_LIMITS.MAX_MESSAGES_PER_SESSION) {
		throw new Error(
			`Session has reached the maximum of ${CHAT_LIMITS.MAX_MESSAGES_PER_SESSION} messages. Please start a new session.`,
		);
	}

	// Add user message
	const userMessage = {
		role: "user" as const,
		content,
		timestamp: new Date(),
	};
	session.messages.push(userMessage);

	// Build context and stream AI response
	const systemPrompt = await buildSystemPrompt(userId);

	const recentMessages = session.messages
		.slice(-CHAT_LIMITS.CONTEXT_MESSAGE_COUNT)
		.map((m) => ({ role: m.role, content: m.content }));

	const aiResponse = await streamLLMChat(
		systemPrompt,
		recentMessages,
		onChunk,
	);

	// Add assistant message
	const assistantMessage = {
		role: "assistant" as const,
		content: aiResponse,
		timestamp: new Date(),
	};
	session.messages.push(assistantMessage);

	// Auto-generate title from first user message
	if (session.title === "New Chat" && session.messages.length <= 2) {
		try {
			const titlePrompt = `Generate a very short title (3-6 words, no quotes) for a chat that starts with: "${content.slice(0, 200)}"`;
			const title = await callLLM(titlePrompt);
			session.title = title.replace(/["']/g, "").trim().slice(0, 100);
		} catch {
			// Keep default title on failure
		}
	}

	session.lastMessageAt = new Date();
	await session.save();

	return { userMessage, assistantContent: aiResponse };
};
