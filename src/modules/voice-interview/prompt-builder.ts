import type {
	LanguageType,
	VoiceInterviewDifficulty,
	VoiceInterviewMode,
	VoiceInterviewType,
} from "./voice-interview.constants";
import {
	URDU_FIRST_MESSAGE_BY_MODE,
	VOICE_PERSONALITY_PRESETS,
} from "./voice-interview.constants";
import type { AdaptiveContext } from "./adaptive-engine";

type PromptParams = {
	mode: VoiceInterviewMode;
	interviewType: VoiceInterviewType;
	difficulty: VoiceInterviewDifficulty;
	duration: number;
	topic?: string;
	resumeText?: string;
	jobDescription?: string;
	adaptiveContext?: AdaptiveContext;
	personality?: string;
	customInstructions?: string;
	language?: LanguageType;
};

const difficultyDescriptions: Record<VoiceInterviewDifficulty, string> = {
	easy: "entry-level/junior positions. Ask straightforward, fundamental questions. Be encouraging and supportive.",
	medium: "mid-level positions. Ask moderately challenging questions that require practical experience. Probe for depth.",
	hard: "senior/staff-level positions. Ask complex, open-ended questions requiring deep expertise. Challenge assumptions and push for thorough answers.",
};

const typeDescriptions: Record<VoiceInterviewType, string> = {
	technical:
		"Focus on technical skills, coding concepts, system design, and problem-solving abilities.",
	behavioral:
		"Focus on past experiences, leadership, teamwork, conflict resolution, and situational judgment using the STAR method.",
	hr: "Focus on culture fit, motivation, career goals, salary expectations, and general professional qualities.",
	mixed: "Mix technical, behavioral, and HR questions to simulate a comprehensive interview round.",
};

export const buildSystemPrompt = (params: PromptParams): string => {
	const {
		mode,
		interviewType,
		difficulty,
		duration,
		topic,
		resumeText,
		jobDescription,
		adaptiveContext,
		personality,
		customInstructions,
		language,
	} = params;

	// Look up personality preset for tone instruction
	const preset = personality
		? VOICE_PERSONALITY_PRESETS.find((p) => p.id === personality)
		: undefined;

	const baseRules = `
INTERVIEW CONDUCT RULES:
- Ask ONE question at a time. Wait for the candidate's response before proceeding.
- Listen carefully and ask relevant follow-up questions based on their answers.
- If the candidate is silent for more than 10 seconds, gently prompt them or offer to rephrase.
- The interview should last approximately ${duration} minutes.
- When about 2 minutes remain, wrap up with a final question and then thank the candidate.
- Do NOT reveal that you are an AI unless directly asked.
- Do NOT provide answers to your own questions.
- Start with a brief introduction and a warm-up question before diving into the main topics.
- Adjust question difficulty based on the candidate's responses - if they struggle, slightly ease up; if they excel, challenge them more.
${preset ? `\nTONE & PERSONALITY:\n${preset.toneInstruction}` : "- Maintain a professional but friendly tone throughout."}
`;

	let contextSection = "";

	if (mode === "resume_jd") {
		contextSection = `
INTERVIEW CONTEXT:
You are conducting a ${interviewType} interview tailored to the candidate's background and the target role.
Difficulty level: ${difficultyDescriptions[difficulty]}

CANDIDATE'S RESUME:
${resumeText || "Resume not available - ask general questions instead."}

TARGET JOB DESCRIPTION:
${jobDescription || "Job description not available - conduct a general interview."}

INSTRUCTIONS:
- Reference specific items from the candidate's resume (projects, skills, experience) in your questions.
- Ask questions that assess how well the candidate's experience matches the job requirements.
- Probe deeper into any gaps between their experience and the job requirements.
- Focus on their most relevant experience and skills for this role.
`;
	} else if (mode === "topic") {
		contextSection = `
INTERVIEW CONTEXT:
You are conducting a focused ${interviewType} interview on the topic: ${topic || "General Software Engineering"}.
Difficulty level: ${difficultyDescriptions[difficulty]}

INSTRUCTIONS:
- Start with fundamental concepts and progressively increase difficulty.
- Cover breadth across the topic, then dive deep into areas where the candidate shows strength.
- Include practical scenario-based questions related to ${topic}.
- Ask about best practices, common pitfalls, and real-world applications.
${typeDescriptions[interviewType]}
`;
	} else {
		contextSection = `
INTERVIEW CONTEXT:
You are conducting a ${interviewType} interview.
Difficulty level: ${difficultyDescriptions[difficulty]}

INSTRUCTIONS:
- Cover a range of topics appropriate for the interview type.
- Adapt your questions based on the candidate's apparent experience level.
${typeDescriptions[interviewType]}
`;
	}

	let adaptiveSection = "";
	if (adaptiveContext) {
		const parts: string[] = [];
		if (adaptiveContext.weakAreas.length > 0) {
			parts.push(
				`PRIORITY AREAS (candidate struggles here - ask more questions on these):\n- ${adaptiveContext.weakAreas.join("\n- ")}`,
			);
		}
		if (adaptiveContext.commonWeaknesses.length > 0) {
			parts.push(
				`RECURRING WEAKNESSES (address these patterns):\n- ${adaptiveContext.commonWeaknesses.join("\n- ")}`,
			);
		}
		if (adaptiveContext.strongAreas.length > 0) {
			parts.push(
				`STRONG AREAS (challenge at a higher level):\n- ${adaptiveContext.strongAreas.join("\n- ")}`,
			);
		}
		parts.push(
			`Performance trend: ${adaptiveContext.overallTrend} (over ${adaptiveContext.totalCompletedInterviews} interviews)`,
		);

		adaptiveSection = `
PERSONALIZED FOCUS:
This interview is personalized based on the candidate's past performance across ${adaptiveContext.totalCompletedInterviews} interviews.
${parts.join("\n\n")}

Instructions:
- Spend more time probing weak areas to help the candidate improve.
- For strong areas, ask harder follow-up questions to push their limits.
- Dynamically adjust difficulty based on their responses within the session.
`;
	}

	let customSection = "";
	if (customInstructions) {
		customSection = `
CUSTOM INSTRUCTIONS FROM THE CANDIDATE:
The candidate has provided the following specific instructions for this interview. Follow these closely while still maintaining the overall interview structure:
${customInstructions}
`;
	}

	let languageSection = "";
	if (language && language !== "english") {
		languageSection = `
LANGUAGE:
Conduct the entire interview in **Urdu**. Speak only Urdu — even if the candidate replies in English, gently steer the conversation back to Urdu. Use a natural conversational tone. All your questions, follow-ups, and closing remarks must be in Urdu.
`;
	}

	return `You are an experienced interviewer conducting a mock interview session. Your role is to simulate a realistic interview experience to help the candidate practice and improve.

${contextSection}
${adaptiveSection}
${customSection}
${languageSection}
${baseRules}`;
};

export const buildFirstMessage = (
	_interviewType: VoiceInterviewType,
	mode: VoiceInterviewMode,
	topic?: string,
	language?: LanguageType,
): string => {
	if (language && language !== "english") {
		const template =
			URDU_FIRST_MESSAGE_BY_MODE[mode] ?? URDU_FIRST_MESSAGE_BY_MODE.custom;
		return template.replace(/\{topic\}/g, topic || "اس موضوع");
	}

	if (mode === "resume_jd") {
		return `Hi, thanks for joining today. I've gone through your resume and the job description, so I have a few questions ready. To kick things off — could you tell me a bit about yourself and what drew you to this role?`;
	}

	if (mode === "topic" && topic) {
		return `Hi, thanks for joining today. We're going to focus on ${topic} for this conversation. To get started, could you walk me through your experience with ${topic}?`;
	}

	return `Hi, thanks for joining today. I'd like to get a feel for your background and experience. To start things off, could you give me a quick overview of what you've been working on?`;
};
