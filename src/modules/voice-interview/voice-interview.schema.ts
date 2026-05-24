import z from "zod";
import {
	LANGUAGES,
	VOICE_INTERVIEW_DIFFICULTY,
	VOICE_INTERVIEW_MODE,
	VOICE_INTERVIEW_TYPE,
	VOICE_INTERVIEW_TOPICS,
} from "./voice-interview.constants";

export const createVoiceInterviewSchema = z.object({
	mode: z.enum([
		VOICE_INTERVIEW_MODE.RESUME_JD,
		VOICE_INTERVIEW_MODE.TOPIC,
		VOICE_INTERVIEW_MODE.CUSTOM,
	]),
	interviewType: z.enum([
		VOICE_INTERVIEW_TYPE.TECHNICAL,
		VOICE_INTERVIEW_TYPE.BEHAVIORAL,
		VOICE_INTERVIEW_TYPE.HR,
		VOICE_INTERVIEW_TYPE.MIXED,
	]),
	duration: z
		.number({ required_error: "Duration is required" })
		.min(2, "Duration must be at least 2 minutes")
		.max(60, "Duration must be at most 60 minutes"),
	difficulty: z.enum([
		VOICE_INTERVIEW_DIFFICULTY.EASY,
		VOICE_INTERVIEW_DIFFICULTY.MEDIUM,
		VOICE_INTERVIEW_DIFFICULTY.HARD,
	]),
	topic: z.enum(VOICE_INTERVIEW_TOPICS as unknown as [string, ...string[]]).optional(),
	jobDescription: z.string().max(5000).optional(),
	personality: z
		.enum(["professional", "friendly", "tough", "casual"])
		.optional()
		.default("professional"),
	customInstructions: z.string().max(3000).optional(),
	language: z.enum(LANGUAGES).optional(),
	useAvatar: z.boolean().optional(),
});

export type CreateVoiceInterviewSchemaType = z.infer<
	typeof createVoiceInterviewSchema
>;
