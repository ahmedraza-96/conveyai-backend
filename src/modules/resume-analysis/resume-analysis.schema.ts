import { z } from "zod";

export const analyzeResumeSchema = z.object({
	jobDescription: z
		.string()
		.min(10, "Job description must be at least 10 characters"),
});

export type AnalyzeResumeSchemaType = z.infer<typeof analyzeResumeSchema>;
