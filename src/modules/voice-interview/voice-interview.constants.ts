export const VOICE_INTERVIEW_STATUS = {
	CREATED: "created",
	IN_PROGRESS: "in_progress",
	COMPLETED: "completed",
	FAILED: "failed",
	CANCELLED: "cancelled",
} as const;

export type VoiceInterviewStatus =
	(typeof VOICE_INTERVIEW_STATUS)[keyof typeof VOICE_INTERVIEW_STATUS];

export const VOICE_INTERVIEW_MODE = {
	RESUME_JD: "resume_jd",
	TOPIC: "topic",
	CUSTOM: "custom",
} as const;

export type VoiceInterviewMode =
	(typeof VOICE_INTERVIEW_MODE)[keyof typeof VOICE_INTERVIEW_MODE];

export const VOICE_INTERVIEW_TYPE = {
	TECHNICAL: "technical",
	BEHAVIORAL: "behavioral",
	HR: "hr",
	MIXED: "mixed",
} as const;

export type VoiceInterviewType =
	(typeof VOICE_INTERVIEW_TYPE)[keyof typeof VOICE_INTERVIEW_TYPE];

export const VOICE_INTERVIEW_DIFFICULTY = {
	EASY: "easy",
	MEDIUM: "medium",
	HARD: "hard",
} as const;

export type VoiceInterviewDifficulty =
	(typeof VOICE_INTERVIEW_DIFFICULTY)[keyof typeof VOICE_INTERVIEW_DIFFICULTY];

export const VOICE_INTERVIEW_ANALYSIS_STATUS = {
	PENDING: "pending",
	COMPLETED: "completed",
	FAILED: "failed",
} as const;

export type VoiceInterviewAnalysisStatus =
	(typeof VOICE_INTERVIEW_ANALYSIS_STATUS)[keyof typeof VOICE_INTERVIEW_ANALYSIS_STATUS];

export const VOICE_INTERVIEW_TOPICS = [
	"JavaScript",
	"TypeScript",
	"React",
	"Node.js",
	"Python",
	"Java",
	"System Design",
	"Data Structures & Algorithms",
	"SQL & Databases",
	"DevOps & CI/CD",
	"Cloud Computing (AWS/GCP/Azure)",
	"Machine Learning",
	"API Design",
	"Microservices",
	"Security",
] as const;

export type VoiceInterviewTopic = (typeof VOICE_INTERVIEW_TOPICS)[number];

export const VOICE_PERSONALITY_PRESETS = [
	{
		id: "professional",
		name: "Professional",
		description: "Formal and structured interview style",
		voiceProvider: "11labs" as const,
		voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel - calm, professional
		toneInstruction:
			"Maintain a professional, formal tone. Be polite but direct. Keep responses structured and business-like.",
	},
	{
		id: "friendly",
		name: "Friendly & Supportive",
		description: "Warm, encouraging, puts you at ease",
		voiceProvider: "11labs" as const,
		voiceId: "EXAVITQu4vr4xnSDxMaL", // Sarah - soft, warm
		toneInstruction:
			"Be warm, friendly, and encouraging. Use positive reinforcement. Make the candidate feel comfortable and supported. Offer reassurance when they struggle.",
	},
	{
		id: "tough",
		name: "Tough Interviewer",
		description: "Challenging, pushes you to think deeper",
		voiceProvider: "11labs" as const,
		voiceId: "pNInz6obpgDQGcFmaJgB", // Adam - deep, authoritative
		toneInstruction:
			"Be direct and challenging. Push the candidate to think deeper. Ask pointed follow-up questions. Don't accept surface-level answers. Maintain high standards.",
	},
	{
		id: "casual",
		name: "Casual & Conversational",
		description: "Relaxed, like chatting with a colleague",
		voiceProvider: "11labs" as const,
		voiceId: "29vD33N1CtxCmqQRPOHJ", // Drew - conversational
		toneInstruction:
			"Keep a relaxed, conversational tone like chatting with a colleague. Use informal language. Make the interview feel like a friendly discussion rather than a formal assessment.",
	},
] as const;

export type VoicePersonalityPresetId =
	(typeof VOICE_PERSONALITY_PRESETS)[number]["id"];

export const LANGUAGES = ["english", "urdu", "roman_urdu"] as const;

export type LanguageType = (typeof LANGUAGES)[number];

export const URDU_VOICE_ID = "ur-PK-UzmaNeural";

export const URDU_FIRST_MESSAGE_BY_MODE = {
	resume_jd:
		"السلام علیکم! آپ کے انٹرویو میں خوش آمدید۔ میں نے آپ کا ریزیومے اور جاب ڈسکرپشن دیکھ لی ہے۔ شروع کرنے سے پہلے، براہِ کرم اپنے بارے میں مختصر تعارف دیجیے اور بتائیے کہ آپ کو اس کردار میں کیا دلچسپی ہے؟",
	topic:
		"السلام علیکم! آپ کے انٹرویو میں خوش آمدید۔ آج ہم {topic} پر مرکوز سوالات کریں گے۔ شروعات اس سے کرتے ہیں — براہِ کرم {topic} میں اپنے تجربے کا مختصر تعارف کرائیں۔",
	custom:
		"السلام علیکم! آپ کے انٹرویو میں خوش آمدید۔ میں آپ سے کچھ سوالات پوچھوں گا تاکہ آپ کی صلاحیتوں اور تجربے کو سمجھ سکوں۔ آغاز اس سے کرتے ہیں — براہِ کرم اپنے پیشہ ورانہ پس منظر کا مختصر جائزہ دیجیے۔",
} as const;
