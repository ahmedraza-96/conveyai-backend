import mongoose from "mongoose";
import config from "../../config/config.service";
import logger from "../../lib/logger.service";
import { callLLM } from "../../lib/llm.service";
import {
	createVapiAssistant,
	getVapiCall,
	listVapiCallsByAssistant,
	type VapiAssistantConfig,
} from "../../lib/vapi.service";
import {
	createTavusConversation,
	getTavusConversation,
	getTavusPersonaId,
	parseTavusTranscript,
} from "../../lib/tavus.service";
import { getUserById } from "../user/user.services";
import {
	extractResumeText,
	fetchResumeBuffer,
} from "../interview-preparation/resume-parser";
import { buildFirstMessage, buildSystemPrompt } from "./prompt-builder";
import { computeAdaptiveContext } from "./adaptive-engine";
import type { CreateVoiceInterviewSchemaType } from "./voice-interview.schema";
import VoiceInterviewModel, {
	type InterviewAnalysis,
	type RubricDimensionScore,
	type SpeechAnalytics,
	type QuestionAnalysis,
	type TranscriptEntry,
	type VoiceInterviewDoc,
} from "./voice-interview.model";
import {
	RUBRIC_DIMENSION_IDS,
	RUBRIC_VERSION,
	buildRubricPromptSection,
	computeOverallFromRubric,
	getAnchorLabel,
	getDimensionLabel,
	getDimensionWeight,
	type RubricDimensionId,
} from "./rubric";
import {
	VOICE_INTERVIEW_ANALYSIS_STATUS,
	VOICE_INTERVIEW_STATUS,
	VOICE_PERSONALITY_PRESETS,
} from "./voice-interview.constants";
import { resolveVoiceForSession } from "./voice-options";
import type {
	LanguageType,
	VoiceInterviewMode,
	VoiceInterviewType,
} from "./voice-interview.constants";

export const createSession = async (
	data: CreateVoiceInterviewSchemaType,
	userId: string,
): Promise<VoiceInterviewDoc> => {
	const user = await getUserById(userId);
	let resumeText = "";
	const resumeUrl = user.resume || undefined;

	if (data.mode === "resume_jd" && user.resume) {
		try {
			const extension = user.resume.toLowerCase().split(".").pop();
			if (extension === "pdf") {
				resumeText = await extractResumeText(
					user.resume,
					Buffer.alloc(0),
					user.resume,
				);
			} else {
				const buffer = await fetchResumeBuffer(user.resume);
				resumeText = await extractResumeText(user.resume, buffer);
			}
		} catch (err) {
			logger.warn(
				{ userId, error: (err as Error).message },
				"Failed to parse resume, proceeding without it",
			);
		}
	}

	const jobDescription =
		data.jobDescription || user.jobDescription || undefined;

	// Compute adaptive context from past performance
	let adaptiveContext = null;
	let isAdaptive = false;
	try {
		adaptiveContext = await computeAdaptiveContext(userId);
		if (adaptiveContext) {
			isAdaptive = true;
			logger.info(
				{ userId, adaptiveContext },
				"Using adaptive context for session",
			);
		}
	} catch (err) {
		logger.warn(
			{ userId, error: (err as Error).message },
			"Failed to compute adaptive context, proceeding without it",
		);
	}

	// Look up personality preset for voice configuration
	const preset =
		VOICE_PERSONALITY_PRESETS.find((p) => p.id === data.personality) ||
		VOICE_PERSONALITY_PRESETS[0];

	// Resolve effective language: per-session > user default > english
	const userPreferred =
		(user as unknown as { preferredLanguage?: LanguageType })
			.preferredLanguage;
	const language: LanguageType =
		(data.language as LanguageType | undefined) ??
		userPreferred ??
		"english";

	const systemPrompt = buildSystemPrompt({
		mode: data.mode as VoiceInterviewMode,
		interviewType: data.interviewType as VoiceInterviewType,
		difficulty: data.difficulty as "easy" | "medium" | "hard",
		duration: data.duration,
		topic: data.topic,
		resumeText,
		jobDescription,
		adaptiveContext: adaptiveContext || undefined,
		personality: data.personality,
		customInstructions: data.customInstructions,
		language,
	});

	const firstMessage = buildFirstMessage(
		data.interviewType as VoiceInterviewType,
		data.mode as VoiceInterviewMode,
		data.topic,
		language,
	);

	const isUrdu = language !== "english";

	const userVoicePref = (user as unknown as { preferredVoiceId?: string })
		.preferredVoiceId;
	const resolvedVoice = resolveVoiceForSession(userVoicePref, language);

	const assistantConfig: VapiAssistantConfig = {
		name: `iv-${String(userId).slice(-6)}-${Date.now().toString(36)}`,
		model: {
			provider: "google",
			model: "gemini-2.0-flash",
			messages: [{ role: "system", content: systemPrompt }],
			temperature: 0.7,
		},
		voice: resolvedVoice ?? {
			provider: preset.voiceProvider,
			voiceId: preset.voiceId,
		},
		firstMessage,
		endCallMessage: isUrdu
			? "آپ کے انٹرویو سیشن میں شرکت کا شکریہ۔ آپ کی کارکردگی کا تجزیہ کیا جا رہا ہے اور تفصیلی فیڈبیک جلد فراہم کر دی جائے گی۔ بہترین خواہشات!"
			: "Thank you for participating in this interview session. Your performance is being analyzed and you'll receive detailed feedback shortly. Good luck!",
		maxDurationSeconds: data.duration * 60,
		silenceTimeoutSeconds: 30,
	};

	if (isUrdu) {
		assistantConfig.transcriber = {
			provider: "deepgram",
			model: "nova-3",
			language: "ur",
		};
	}

	// === AVATAR PATH (Tavus) ===
	// For avatar-mode sessions we bypass Vapi entirely and run the conversation
	// inside Tavus' Daily.co room. The transcript flows back via Tavus webhooks
	// and feeds into the same Gemini analysis pipeline as Vapi sessions.
	if (data.useAvatar) {
		const personaId = getTavusPersonaId();
		if (!personaId) {
			throw new Error(
				"Tavus persona ID is not configured. Set TAVUS_PERSONA_MALE_ID in the backend env.",
			);
		}

		const conversationalContext = [
			"You are interviewing a candidate. Use the following resume and job description to drive your questions.",
			"",
			"=== JOB DESCRIPTION ===",
			jobDescription || "(none provided)",
			"",
			"=== CANDIDATE RESUME ===",
			resumeText || "(resume could not be parsed)",
			"",
			`Interview type: ${data.interviewType}. Difficulty: ${data.difficulty}. Plan for ~${data.duration} minutes.`,
		].join("\n");

		const tavus = await createTavusConversation({
			personaId,
			conversationName: `iv-${String(userId).slice(-6)}-${Date.now().toString(36)}`,
			conversationalContext,
			customGreeting: firstMessage,
			maxCallDurationSeconds: data.duration * 60,
			callbackUrl: `${config.BACKEND_URL}/api/voice-interviews/webhook/tavus`,
		});

		const session = await VoiceInterviewModel.create({
			userId: new mongoose.Types.ObjectId(userId),
			mode: data.mode,
			interviewType: data.interviewType,
			status: VOICE_INTERVIEW_STATUS.CREATED,
			duration: data.duration,
			difficulty: data.difficulty,
			topic: data.topic,
			resumeUrl,
			jobDescription,
			tavusConversationId: tavus.conversation_id,
			tavusConversationUrl: tavus.conversation_url,
			personality: data.personality,
			customInstructions: data.customInstructions,
			isAdaptive,
			language,
			useAvatar: true,
		});

		logger.info(
			{ sessionId: session._id, conversationId: tavus.conversation_id },
			"Avatar (Tavus) interview session created",
		);

		return session;
	}

	// === DEFAULT PATH (Vapi) ===
	assistantConfig.serverUrl = `${config.BACKEND_URL}/api/voice-interviews/webhook/vapi`;
	logger.info(
		{ serverUrl: assistantConfig.serverUrl },
		"Vapi assistant webhook URL configured",
	);

	const vapiAssistant = await createVapiAssistant(assistantConfig);

	const session = await VoiceInterviewModel.create({
		userId: new mongoose.Types.ObjectId(userId),
		mode: data.mode,
		interviewType: data.interviewType,
		status: VOICE_INTERVIEW_STATUS.CREATED,
		duration: data.duration,
		difficulty: data.difficulty,
		topic: data.topic,
		resumeUrl,
		jobDescription,
		vapiAssistantId: vapiAssistant.id,
		personality: data.personality,
		customInstructions: data.customInstructions,
		isAdaptive,
		language,
		useAvatar: false,
	});

	logger.info(
		{ sessionId: session._id, assistantId: vapiAssistant.id },
		"Voice interview session created",
	);

	return session;
};

export const getByUser = async (
	userId: string,
): Promise<VoiceInterviewDoc[]> => {
	return VoiceInterviewModel.find({
		userId: new mongoose.Types.ObjectId(userId),
	})
		.sort({ createdAt: -1 })
		.exec();
};

export const getById = async (
	id: string,
	userId: string,
): Promise<VoiceInterviewDoc | null> => {
	return VoiceInterviewModel.findOne({
		_id: id,
		userId: new mongoose.Types.ObjectId(userId),
	}).exec();
};

export const deleteById = async (
	id: string,
	userId: string,
): Promise<VoiceInterviewDoc | null> => {
	return VoiceInterviewModel.findOneAndDelete({
		_id: id,
		userId: new mongoose.Types.ObjectId(userId),
	}).exec();
};

export const handleCallEnded = async (
	vapiCallId: string,
	transcript: TranscriptEntry[],
	recordingUrl: string | undefined,
	actualDuration: number | undefined,
): Promise<VoiceInterviewDoc | null> => {
	const session = await VoiceInterviewModel.findOneAndUpdate(
		{ vapiAssistantId: vapiCallId },
		{
			status: VOICE_INTERVIEW_STATUS.COMPLETED,
			transcript,
			recordingUrl,
			actualDuration,
			vapiCallId,
		},
		{ new: true },
	).exec();

	if (!session) {
		// Try matching by vapiCallId directly
		const sessionByCallId = await VoiceInterviewModel.findOneAndUpdate(
			{ vapiCallId },
			{
				status: VOICE_INTERVIEW_STATUS.COMPLETED,
				transcript,
				recordingUrl,
				actualDuration,
			},
			{ new: true },
		).exec();
		return sessionByCallId;
	}

	return session;
};

export const updateSessionCallId = async (
	sessionId: string,
	vapiCallId: string,
): Promise<VoiceInterviewDoc | null> => {
	return VoiceInterviewModel.findByIdAndUpdate(
		sessionId,
		{
			vapiCallId,
			status: VOICE_INTERVIEW_STATUS.IN_PROGRESS,
		},
		{ new: true },
	).exec();
};

const parseCallData = (
	callData: Record<string, unknown>,
): {
	transcript: TranscriptEntry[];
	recordingUrl: string | undefined;
	actualDuration: number | undefined;
} => {
	const artifact = callData.artifact as Record<string, unknown> | undefined;
	const messages = callData.messages as Array<Record<string, unknown>> | undefined;

	const transcript: TranscriptEntry[] = [];

	if (Array.isArray(messages)) {
		for (const entry of messages) {
			if (entry.role === "assistant" || entry.role === "user") {
				transcript.push({
					role: entry.role as "assistant" | "user",
					content: (entry.message as string) || "",
					timestamp: (entry.time as number) || 0,
				});
			}
		}
	}

	// Fallback to artifact.messages format
	if (transcript.length === 0 && artifact?.messages) {
		for (const entry of artifact.messages as Array<Record<string, unknown>>) {
			if (entry.role === "assistant" || entry.role === "user") {
				transcript.push({
					role: entry.role as "assistant" | "user",
					content: (entry.message as string) || (entry.text as string) || "",
					timestamp: (entry.secondsFromStart as number) || (entry.time as number) || 0,
				});
			}
		}
	}

	const recordingUrl =
		(callData.recordingUrl as string) ||
		(artifact?.recordingUrl as string) ||
		(artifact?.recordingS3PathUrl as string) ||
		undefined;

	const actualDuration =
		(callData.duration as number) ||
		(callData.endedAt && callData.startedAt
			? Math.round(
					(new Date(callData.endedAt as string).getTime() -
						new Date(callData.startedAt as string).getTime()) /
						1000,
				)
			: undefined);

	return { transcript, recordingUrl, actualDuration };
};

export const fetchAndSaveCallData = async (
	session: VoiceInterviewDoc,
): Promise<VoiceInterviewDoc | null> => {
	const callId = session.vapiCallId;
	if (!callId && !session.vapiAssistantId) {
		logger.warn(
			{ sessionId: session._id },
			"No vapiCallId or vapiAssistantId on session, cannot fetch call data",
		);
		return session;
	}

	try {
		let callData: Record<string, unknown> | null = null;
		let resolvedCallId = callId;

		// Try direct call lookup first
		if (callId) {
			try {
				callData = await getVapiCall(callId) as Record<string, unknown>;
			} catch (directError) {
				logger.warn(
					{ sessionId: session._id, callId, error: (directError as Error).message },
					"Direct call lookup failed, trying assistant-based fallback",
				);
			}
		}

		// Fallback: list calls by assistant ID
		if (!callData && session.vapiAssistantId) {
			logger.info(
				{ sessionId: session._id, vapiAssistantId: session.vapiAssistantId },
				"Fetching calls by assistant ID as fallback",
			);
			const calls = await listVapiCallsByAssistant(session.vapiAssistantId);
			if (calls.length > 0) {
				callData = calls[0] as Record<string, unknown>;
				resolvedCallId = callData.id as string;
				logger.info(
					{ sessionId: session._id, resolvedCallId, callStatus: callData.status },
					"Found call via assistant-based lookup",
				);
			} else {
				logger.warn(
					{ sessionId: session._id, vapiAssistantId: session.vapiAssistantId },
					"No calls found for assistant",
				);
			}
		}

		if (!callData) {
			throw new Error("Could not retrieve call data from Vapi via any method");
		}

		const artifact = callData.artifact as Record<string, unknown> | undefined;
		logger.info(
			{
				sessionId: session._id,
				callId: resolvedCallId,
				callStatus: callData.status,
				hasMessages: Array.isArray(callData.messages),
				messagesCount: Array.isArray(callData.messages) ? (callData.messages as unknown[]).length : 0,
				hasArtifact: !!artifact,
				artifactMessagesCount: Array.isArray(artifact?.messages) ? (artifact.messages as unknown[]).length : 0,
				hasRecordingUrl: !!callData.recordingUrl,
				vapiResponseKeys: Object.keys(callData),
			},
			"fetchAndSaveCallData: Vapi API response details",
		);

		const { transcript, recordingUrl, actualDuration } = parseCallData(callData);

		const updated = await VoiceInterviewModel.findByIdAndUpdate(
			session._id,
			{
				status: VOICE_INTERVIEW_STATUS.COMPLETED,
				transcript: transcript.length > 0 ? transcript : session.transcript,
				recordingUrl: recordingUrl || session.recordingUrl,
				actualDuration: actualDuration || session.actualDuration,
				...(resolvedCallId && resolvedCallId !== callId ? { vapiCallId: resolvedCallId } : {}),
			},
			{ new: true },
		).exec();

		logger.info(
			{
				sessionId: session._id,
				transcriptCount: transcript.length,
				hasRecording: !!recordingUrl,
			},
			"Fetched and saved Vapi call data",
		);

		return updated;
	} catch (error) {
		logger.error(
			{ sessionId: session._id, error: (error as Error).message },
			"Failed to fetch Vapi call data",
		);
		// Still mark as completed even if fetch fails
		return VoiceInterviewModel.findByIdAndUpdate(
			session._id,
			{ status: VOICE_INTERVIEW_STATUS.COMPLETED },
			{ new: true },
		).exec();
	}
};

export const fetchAndSaveTavusCallData = async (
	session: VoiceInterviewDoc,
): Promise<VoiceInterviewDoc | null> => {
	const conversationId = session.tavusConversationId;
	if (!conversationId) {
		logger.warn(
			{ sessionId: session._id },
			"No tavusConversationId on session, cannot fetch transcript",
		);
		return session;
	}

	try {
		const conversation = await getTavusConversation(conversationId);
		const parsed = parseTavusTranscript(conversation.transcript);

		const transcript: TranscriptEntry[] = parsed.map((e, idx) => ({
			role: e.role,
			content: e.content,
			timestamp: typeof e.timestamp === "number" ? e.timestamp : idx,
		}));

		const updated = await VoiceInterviewModel.findByIdAndUpdate(
			session._id,
			{
				status: VOICE_INTERVIEW_STATUS.COMPLETED,
				transcript: transcript.length > 0 ? transcript : session.transcript,
			},
			{ new: true },
		).exec();

		logger.info(
			{
				sessionId: session._id,
				conversationId,
				transcriptCount: transcript.length,
			},
			"Fetched and saved Tavus conversation transcript",
		);

		return updated;
	} catch (error) {
		logger.error(
			{ sessionId: session._id, conversationId, error: (error as Error).message },
			"Failed to fetch Tavus conversation transcript",
		);
		return VoiceInterviewModel.findByIdAndUpdate(
			session._id,
			{ status: VOICE_INTERVIEW_STATUS.COMPLETED },
			{ new: true },
		).exec();
	}
};

export const handleTavusConversationEnded = async (
	conversationId: string,
): Promise<VoiceInterviewDoc | null> => {
	const session = await VoiceInterviewModel.findOne({
		tavusConversationId: conversationId,
	}).exec();
	if (!session) {
		logger.warn({ conversationId }, "Tavus webhook: no matching session found");
		return null;
	}
	return fetchAndSaveTavusCallData(session);
};

const FILLER_WORDS = [
	"um",
	"uh",
	"like",
	"you know",
	"basically",
	"actually",
	"so",
	"right",
	"i mean",
	"kind of",
	"sort of",
];

export const computeSpeechAnalytics = (
	transcript: TranscriptEntry[],
	actualDurationSec?: number,
): SpeechAnalytics => {
	const userMessages = transcript.filter((t) => t.role === "user");
	const totalUserMessages = userMessages.length;

	if (totalUserMessages === 0) {
		return {
			totalWords: 0,
			totalUserMessages: 0,
			averageWordsPerResponse: 0,
			wordsPerMinute: 0,
			vocabularyRichness: 0,
			uniqueWordCount: 0,
			fillerWords: [],
			totalFillerCount: 0,
			fillerPercentage: 0,
			longestResponse: 0,
			shortestResponse: 0,
			averageResponseTimeSec: 0,
			responseTimes: [],
			pauseGaps: [],
			averagePauseGapSec: 0,
		};
	}

	// Count words per message
	const wordCounts = userMessages.map(
		(m) => m.content.split(/\s+/).filter(Boolean).length,
	);
	const totalWords = wordCounts.reduce((a, b) => a + b, 0);
	const averageWordsPerResponse = Math.round(totalWords / totalUserMessages);
	const longestResponse = Math.max(...wordCounts);
	const shortestResponse = Math.min(...wordCounts);

	// WPM estimate
	let wordsPerMinute = 0;
	if (actualDurationSec && actualDurationSec > 0) {
		wordsPerMinute = Math.round(totalWords / (actualDurationSec / 60));
	} else {
		// Estimate from timestamps
		const timestamps = userMessages.map((m) => m.timestamp);
		if (timestamps.length >= 2) {
			const span = timestamps[timestamps.length - 1] - timestamps[0];
			if (span > 0) {
				wordsPerMinute = Math.round(totalWords / (span / 60));
			}
		}
	}

	// Vocabulary richness
	const allWords = userMessages
		.flatMap((m) =>
			m.content
				.toLowerCase()
				.replace(/[^a-z\s']/g, "")
				.split(/\s+/)
				.filter(Boolean),
		);
	const uniqueWords = new Set(allWords);
	const uniqueWordCount = uniqueWords.size;
	const vocabularyRichness =
		totalWords > 0
			? Math.round((uniqueWordCount / totalWords) * 100)
			: 0;

	// Filler words detection
	const fullText = userMessages
		.map((m) => m.content.toLowerCase())
		.join(" ");
	const fillerWordStats = FILLER_WORDS.map((word) => {
		const regex = new RegExp(`\\b${word}\\b`, "gi");
		const matches = fullText.match(regex);
		const count = matches ? matches.length : 0;
		return {
			word,
			count,
			percentage:
				totalWords > 0
					? Math.round((count / totalWords) * 1000) / 10
					: 0,
		};
	}).filter((f) => f.count > 0);

	const totalFillerCount = fillerWordStats.reduce(
		(a, b) => a + b.count,
		0,
	);
	const fillerPercentage =
		totalWords > 0
			? Math.round((totalFillerCount / totalWords) * 1000) / 10
			: 0;

	// Response times (gap between assistant message end and user message start)
	const responseTimes: number[] = [];
	for (let i = 1; i < transcript.length; i++) {
		if (
			transcript[i].role === "user" &&
			transcript[i - 1].role === "assistant"
		) {
			const gap = transcript[i].timestamp - transcript[i - 1].timestamp;
			if (gap > 0) {
				responseTimes.push(Math.round(gap * 10) / 10);
			}
		}
	}

	const averageResponseTimeSec =
		responseTimes.length > 0
			? Math.round(
					(responseTimes.reduce((a, b) => a + b, 0) /
						responseTimes.length) *
						10,
				) / 10
			: 0;

	// Pause gaps (>3 seconds between any consecutive messages)
	const pauseGaps: number[] = [];
	for (let i = 1; i < transcript.length; i++) {
		const gap = transcript[i].timestamp - transcript[i - 1].timestamp;
		if (gap > 3) {
			pauseGaps.push(Math.round(gap * 10) / 10);
		}
	}

	const averagePauseGapSec =
		pauseGaps.length > 0
			? Math.round(
					(pauseGaps.reduce((a, b) => a + b, 0) /
						pauseGaps.length) *
						10,
				) / 10
			: 0;

	return {
		totalWords,
		totalUserMessages,
		averageWordsPerResponse,
		wordsPerMinute,
		vocabularyRichness,
		uniqueWordCount,
		fillerWords: fillerWordStats,
		totalFillerCount,
		fillerPercentage,
		longestResponse,
		shortestResponse,
		averageResponseTimeSec,
		responseTimes,
		pauseGaps,
		averagePauseGapSec,
	};
};

interface QAPair {
	question: string;
	answer: string;
}

export const extractQAPairs = (transcript: TranscriptEntry[]): QAPair[] => {
	const pairs: QAPair[] = [];

	for (let i = 0; i < transcript.length - 1; i++) {
		if (
			transcript[i].role === "assistant" &&
			transcript[i].content.includes("?")
		) {
			// Find the next user message
			for (let j = i + 1; j < transcript.length; j++) {
				if (transcript[j].role === "user") {
					pairs.push({
						question: transcript[i].content,
						answer: transcript[j].content,
					});
					break;
				}
			}
		}
	}

	return pairs;
};

const generateQuestionAnalysis = async (
	session: VoiceInterviewDoc,
): Promise<QuestionAnalysis[]> => {
	const pairs = extractQAPairs(session.transcript);

	if (pairs.length === 0) {
		return [];
	}

	const qaPairsText = pairs
		.map(
			(p, i) =>
				`Q${i + 1}: ${p.question}\nCandidate's Answer: ${p.answer}`,
		)
		.join("\n\n");

	const sessionLanguage = (session.language as LanguageType | undefined) || "english";
	const languageNote =
		sessionLanguage !== "english"
			? `\nLANGUAGE NOTE: The transcript below may be in Urdu (Nastaliq) or Roman Urdu. Write ALL fields (idealAnswer, missingPoints, strengths, feedback) in clear English. Keep the question and userAnswer fields verbatim from the transcript.\n`
			: "";

	const prompt = `You are an expert interview evaluator. For each question-answer pair below, generate an ideal answer and compare it with the candidate's answer.
${languageNote}

Interview Details:
- Type: ${session.interviewType}
- Difficulty: ${session.difficulty}
${session.topic ? `- Topic: ${session.topic}` : ""}

Q&A Pairs:
${qaPairsText}

Respond with a JSON array (no markdown, no code fences, ONLY valid JSON) where each element has:
{
  "questionIndex": <0-based index>,
  "question": "<the question>",
  "userAnswer": "<the candidate's actual answer>",
  "idealAnswer": "<a comprehensive model answer for this question>",
  "similarityScore": <0-100 how close the candidate's answer is to ideal>,
  "missingPoints": ["<key point the candidate missed>", ...],
  "strengths": ["<what the candidate did well>", ...],
  "feedback": "<1-2 sentence specific feedback>"
}`;

	const responseText = await callLLM(prompt);

	const cleaned = responseText
		.replace(/```json/gi, "")
		.replace(/```/g, "")
		.replace(/\u201c|\u201d/g, '"')
		.trim();

	try {
		const parsed = JSON.parse(cleaned);
		if (Array.isArray(parsed)) {
			return parsed as QuestionAnalysis[];
		}
		return [];
	} catch {
		const match = cleaned.match(/\[[\s\S]*\]/);
		if (match) {
			try {
				return JSON.parse(match[0]) as QuestionAnalysis[];
			} catch {
				// fallback
			}
		}
		logger.warn("Failed to parse question analysis response");
		return [];
	}
};

const buildFailureAnalysis = (reason: string): InterviewAnalysis => ({
	overallScore: 0,
	strengths: [],
	weaknesses: ["Analysis could not be generated"],
	communicationFeedback: "Analysis unavailable",
	technicalFeedback: "Analysis unavailable",
	recommendations: ["Please retry the interview for analysis"],
	summary: reason,
});

/**
 * Normalizes the raw rubric array from the LLM response: canonicalizes the
 * dimension list (one entry per known id in rubric order), clamps scores
 * to 0-4, injects the authoritative weight + anchor label from `rubric.ts`,
 * and caps evidence at 3 items per dimension. Missing dimensions fall back
 * to score=0 with an empty evidence list.
 */
const normalizeRubricScores = (
	raw: unknown,
): RubricDimensionScore[] => {
	const rawArr = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
	const byId = new Map<RubricDimensionId, Record<string, unknown>>();
	for (const entry of rawArr) {
		const id = entry?.dimension;
		if (
			typeof id === "string" &&
			(RUBRIC_DIMENSION_IDS as string[]).includes(id)
		) {
			byId.set(id as RubricDimensionId, entry);
		}
	}

	return RUBRIC_DIMENSION_IDS.map((id): RubricDimensionScore => {
		const entry = byId.get(id) ?? {};
		const scoreRaw = Number(entry.score);
		const score = Number.isFinite(scoreRaw)
			? Math.max(0, Math.min(4, Math.round(scoreRaw)))
			: 0;
		const feedback =
			typeof entry.feedback === "string" && entry.feedback.trim().length > 0
				? entry.feedback.trim()
				: `${getDimensionLabel(id)} was not scored in detail.`;
		const rawEvidence = Array.isArray(entry.evidence) ? entry.evidence : [];
		const evidence = rawEvidence
			.slice(0, 3)
			.map((e) => {
				const obj = e as Record<string, unknown>;
				const quote = typeof obj?.quote === "string" ? obj.quote.trim() : "";
				const rationale =
					typeof obj?.rationale === "string" ? obj.rationale.trim() : "";
				const tsRaw = Number(obj?.timestamp);
				const timestamp = Number.isFinite(tsRaw) && tsRaw >= 0 ? tsRaw : undefined;
				return { quote, rationale, timestamp };
			})
			.filter((e) => e.quote.length > 0 && e.rationale.length > 0);
		return {
			dimension: id,
			score,
			weight: getDimensionWeight(id),
			anchorLabel: getAnchorLabel(score),
			feedback,
			evidence,
		};
	});
};

const formatSpeechAnalyticsForPrompt = (
	analytics: SpeechAnalytics | undefined,
): string => {
	if (!analytics || analytics.totalWords === 0) {
		return "(Speech analytics unavailable \u2014 fall back to transcript cues only.)";
	}
	const topFillers = analytics.fillerWords
		.slice(0, 5)
		.map((f) => `${f.word}(${f.count})`)
		.join(", ") || "none";
	return [
		`- Words per minute: ${analytics.wordsPerMinute}`,
		`- Filler-word share: ${analytics.fillerPercentage}% (top: ${topFillers})`,
		`- Avg response latency: ${analytics.averageResponseTimeSec}s`,
		`- Avg pause gap: ${analytics.averagePauseGapSec}s`,
		`- Vocabulary richness: ${analytics.vocabularyRichness}% (${analytics.uniqueWordCount} unique / ${analytics.totalWords} total)`,
		`- Avg words per response: ${analytics.averageWordsPerResponse}`,
	].join("\n");
};

export const transliterateToRomanUrdu = async (
	transcript: TranscriptEntry[],
): Promise<TranscriptEntry[]> => {
	if (!transcript || transcript.length === 0) return transcript;

	const payload = transcript.map((t) => ({
		role: t.role,
		content: t.content,
		timestamp: t.timestamp,
	}));

	const prompt = `Convert the following Urdu (Nastaliq) interview transcript to Roman Urdu (Latin script).
RULES:
- Preserve speaker turns and timestamps exactly.
- Preserve punctuation and sentence structure.
- Use natural Roman Urdu spelling (e.g. "aap kaise hain", "main software engineer hoon").
- If a line is already in English or Latin script, leave it unchanged.
- Output ONLY a valid JSON array, no markdown, no code fences, no commentary.
- Each element must have: {"role": "assistant"|"user", "content": "<roman urdu text>", "timestamp": <number>}.

INPUT:
${JSON.stringify(payload)}`;

	try {
		const responseText = await callLLM(prompt);
		const cleaned = responseText
			.replace(/```json/gi, "")
			.replace(/```/g, "")
			.trim();
		let parsed: unknown;
		try {
			parsed = JSON.parse(cleaned);
		} catch {
			const match = cleaned.match(/\[[\s\S]*\]/);
			parsed = match ? JSON.parse(match[0]) : null;
		}
		if (!Array.isArray(parsed) || parsed.length !== transcript.length) {
			logger.warn("Transliteration response shape unexpected, keeping original transcript");
			return transcript;
		}
		return parsed.map((entry, i) => {
			const obj = entry as Record<string, unknown>;
			const role = obj.role === "assistant" || obj.role === "user"
				? (obj.role as "assistant" | "user")
				: transcript[i].role;
			const content = typeof obj.content === "string" && obj.content.trim().length > 0
				? obj.content
				: transcript[i].content;
			const tsRaw = Number(obj.timestamp);
			const timestamp = Number.isFinite(tsRaw) ? tsRaw : transcript[i].timestamp;
			return { role, content, timestamp };
		});
	} catch (err) {
		logger.warn(
			{ error: (err as Error).message },
			"Transliteration failed, keeping original transcript",
		);
		return transcript;
	}
};

export const generateAnalysis = async (
	session: VoiceInterviewDoc,
): Promise<InterviewAnalysis> => {
	const transcriptText = session.transcript
		.map((t) => `[${Math.round(t.timestamp)}s] ${t.role === "assistant" ? "Interviewer" : "Candidate"}: ${t.content}`)
		.join("\n");

	// Compute speech analytics up front so we can include them as factual
	// context for the LLM when scoring Confidence & Delivery.
	let speechAnalytics: SpeechAnalytics | undefined;
	try {
		speechAnalytics = computeSpeechAnalytics(
			session.transcript,
			session.actualDuration,
		);
	} catch (err) {
		logger.warn(
			{ error: (err as Error).message },
			"Failed to compute speech analytics",
		);
	}

	const rubricBlock = buildRubricPromptSection();
	const speechBlock = formatSpeechAnalyticsForPrompt(speechAnalytics);

	const sessionLanguage = (session.language as LanguageType | undefined) || "english";
	const languageBlock =
		sessionLanguage !== "english"
			? `LANGUAGE NOTE:
The interview transcript may be in Urdu (either Nastaliq script or Roman Urdu / Latin script). **You MUST write all analysis output (strengths, weaknesses, scoring rationale, feedback fields, summary, recommendations) in clear English.** When citing transcript quotes as evidence, keep the original quote verbatim from the transcript and include a short English translation in parentheses immediately after.
`
			: "";

	const prompt = `You are an expert interview evaluator scoring a mock interview against a FIXED, PUBLISHED RUBRIC. You must apply the rubric literally \u2014 every dimension, in order, with the same 0-4 anchors for every interview.

${languageBlock}

INTERVIEW CONTEXT:
- Type: ${session.interviewType}
- Mode: ${session.mode}
- Difficulty: ${session.difficulty}
${session.topic ? `- Topic: ${session.topic}` : ""}
- Duration: ${session.actualDuration ? Math.round(session.actualDuration / 60) : session.duration} minutes
${session.jobDescription ? `- Job description snippet: ${session.jobDescription.slice(0, 400)}` : ""}

OBJECTIVE SPEECH METRICS (ground truth \u2014 use as evidence for Confidence & Delivery):
${speechBlock}

TRANSCRIPT (each line prefixed with an approximate timestamp in seconds):
${transcriptText}

${rubricBlock}

SCORING RULES:
1. For EACH of the five dimensions (in the order given), pick an integer 0-4 using the anchor descriptions. Do not skip dimensions. Do not invent new dimensions.
2. For EACH dimension, cite 2-3 pieces of evidence. Each evidence item MUST be:
   - "quote": an EXACT substring of the Candidate's speech from the transcript above (not paraphrased, not the Interviewer).
   - "timestamp": the integer seconds value shown in the transcript line the quote came from, when available.
   - "rationale": one short sentence explaining how this quote supports the score for this dimension.
3. Do NOT output an overall score \u2014 the server computes it from the weighted rubric.
4. Narrative fields (strengths, weaknesses, communicationFeedback, technicalFeedback, recommendations, summary) remain free-form and should be consistent with the rubric scores you chose.

OUTPUT: a single JSON object, no markdown, no code fences, no commentary before or after.
{
  "rubricScores": [
    {
      "dimension": "technical_accuracy",
      "score": <0-4 integer>,
      "feedback": "<1-2 sentence dimension-specific feedback>",
      "evidence": [
        {"quote": "<exact candidate quote>", "timestamp": <seconds>, "rationale": "<one sentence>"},
        ...
      ]
    },
    { "dimension": "communication_clarity", ... },
    { "dimension": "structured_thinking", ... },
    { "dimension": "confidence_delivery", ... },
    { "dimension": "role_alignment", ... }
  ],
  "strengths": ["<3-5 bullets>"],
  "weaknesses": ["<3-5 bullets>"],
  "communicationFeedback": "<paragraph>",
  "technicalFeedback": "<paragraph>",
  "recommendations": ["<2-4 actionable bullets>"],
  "summary": "<2-3 sentence overall performance summary>"
}`;

	const responseText = await callLLM(prompt);

	const cleaned = responseText
		.replace(/```json/gi, "")
		.replace(/```/g, "")
		.replace(/\u201c|\u201d/g, '"')
		.trim();

	let parsedAny: Record<string, unknown> | null = null;
	try {
		parsedAny = JSON.parse(cleaned) as Record<string, unknown>;
	} catch {
		const match = cleaned.match(/\{[\s\S]*\}/);
		if (match) {
			try {
				parsedAny = JSON.parse(match[0]) as Record<string, unknown>;
			} catch {
				parsedAny = null;
			}
		}
	}

	if (!parsedAny) {
		logger.warn("Failed to parse Gemini analysis response, returning default");
		const fallback = buildFailureAnalysis(
			"The analysis could not be generated for this interview.",
		);
		if (speechAnalytics) fallback.speechAnalytics = speechAnalytics;
		return fallback;
	}

	const rubricScores = normalizeRubricScores(parsedAny.rubricScores);
	const overallScore = computeOverallFromRubric(rubricScores);

	const asStringArr = (v: unknown): string[] =>
		Array.isArray(v)
			? v.filter((x): x is string => typeof x === "string" && x.length > 0)
			: [];
	const asString = (v: unknown, fallback: string): string =>
		typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;

	const baseAnalysis: InterviewAnalysis = {
		overallScore,
		strengths: asStringArr(parsedAny.strengths),
		weaknesses: asStringArr(parsedAny.weaknesses),
		communicationFeedback: asString(
			parsedAny.communicationFeedback,
			"Communication feedback unavailable.",
		),
		technicalFeedback: asString(
			parsedAny.technicalFeedback,
			"Technical feedback unavailable.",
		),
		recommendations: asStringArr(parsedAny.recommendations),
		summary: asString(
			parsedAny.summary,
			"Overall performance summary unavailable.",
		),
		rubricVersion: RUBRIC_VERSION,
		rubricScores,
	};

	if (speechAnalytics) {
		baseAnalysis.speechAnalytics = speechAnalytics;
	}

	// Per-question analysis (unchanged).
	try {
		baseAnalysis.questionAnalysis = await generateQuestionAnalysis(session);
	} catch (err) {
		logger.warn(
			{ error: (err as Error).message },
			"Failed to generate question analysis",
		);
	}

	return baseAnalysis;
};

export const saveAnalysis = async (
	sessionId: string,
	analysis: InterviewAnalysis,
): Promise<VoiceInterviewDoc | null> => {
	return VoiceInterviewModel.findByIdAndUpdate(
		sessionId,
		{
			analysis,
			analysisStatus: VOICE_INTERVIEW_ANALYSIS_STATUS.COMPLETED,
			$unset: { analysisError: 1 },
		},
		{ new: true },
	).exec();
};

export const resetAnalysisStatus = async (
	sessionId: string,
): Promise<VoiceInterviewDoc | null> => {
	return VoiceInterviewModel.findByIdAndUpdate(
		sessionId,
		{
			analysisStatus: VOICE_INTERVIEW_ANALYSIS_STATUS.PENDING,
			$unset: { analysis: 1, analysisError: 1 },
		},
		{ new: true },
	).exec();
};

export const getAnalytics = async (
	userId: string,
): Promise<{
	totalInterviews: number;
	averageScore: number;
	totalPracticeMinutes: number;
	bestScore: number;
	recentScores: Array<{ date: string; score: number }>;
	lastInterview: VoiceInterviewDoc | null;
}> => {
	const userObjectId = new mongoose.Types.ObjectId(userId);

	const sessions = await VoiceInterviewModel.find({
		userId: userObjectId,
		status: VOICE_INTERVIEW_STATUS.COMPLETED,
	})
		.sort({ createdAt: -1 })
		.exec();

	const completedWithAnalysis = sessions.filter((s) => s.analysis);

	const totalInterviews = sessions.length;
	const scores = completedWithAnalysis.map(
		(s) => s.analysis?.overallScore || 0,
	);
	const averageScore =
		scores.length > 0
			? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
			: 0;
	const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
	const totalPracticeMinutes = sessions.reduce(
		(acc, s) =>
			acc + (s.actualDuration ? Math.round(s.actualDuration / 60) : s.duration),
		0,
	);

	const recentScores = completedWithAnalysis.slice(0, 12).map((s) => ({
		date: s.createdAt.toISOString().split("T")[0],
		score: s.analysis?.overallScore || 0,
	}));

	const lastInterview = sessions.length > 0 ? sessions[0] : null;

	return {
		totalInterviews,
		averageScore,
		totalPracticeMinutes,
		bestScore,
		recentScores,
		lastInterview,
	};
};
