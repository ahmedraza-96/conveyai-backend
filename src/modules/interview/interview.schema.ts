import validator from "validator";
import z from "zod";
import { INTERVIEW_STATUS, INTERVIEW_TYPES } from "./interview.constants";

export const createInterviewSchema = z.object({
	title: z.string({ required_error: "Title is required" }).min(1).max(100),
	description: z.string().optional(),
	type: z.enum([INTERVIEW_TYPES.TECHNICAL, INTERVIEW_TYPES.BEHAVIORAL, INTERVIEW_TYPES.MIXED]),
	duration: z.number({ required_error: "Duration is required" }).min(15).max(180), // 15-180 minutes
	questions: z.array(z.string()).min(1, "At least one question is required"),
});

export const updateInterviewSchema = z.object({
	title: z.string().min(1).max(100).optional(),
	description: z.string().optional(),
	type: z.enum([INTERVIEW_TYPES.TECHNICAL, INTERVIEW_TYPES.BEHAVIORAL, INTERVIEW_TYPES.MIXED]).optional(),
	duration: z.number().min(15).max(180).optional(),
	questions: z.array(z.string()).min(1).optional(),
	status: z.enum([INTERVIEW_STATUS.CREATED, INTERVIEW_STATUS.IN_PROGRESS, INTERVIEW_STATUS.COMPLETED, INTERVIEW_STATUS.CANCELLED]).optional(),
});

export const interviewIdSchema = z.object({
	id: z
		.string({ required_error: "Interview ID is required" })
		.refine((value) => validator.isMongoId(value), "Interview ID must be valid"),
});

export type CreateInterviewSchemaType = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewSchemaType = z.infer<typeof updateInterviewSchema>;
export type InterviewIdSchemaType = z.infer<typeof interviewIdSchema>;
