import z from "zod";

export const testGeminiSchema = z.object({
	prompt: z
		.string({ required_error: "Prompt is required" })
		.min(1, "Prompt cannot be empty")
		.max(10000, "Prompt is too long"),
});

export type TestGeminiSchemaType = z.infer<typeof testGeminiSchema>;


