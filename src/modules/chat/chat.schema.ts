import { z } from "zod";
import { CHAT_SESSION_STATUS, CHAT_LIMITS } from "./chat.constants";

export const createChatSessionSchema = z.object({
	title: z.string().max(200).optional(),
});

export type CreateChatSessionSchemaType = z.infer<
	typeof createChatSessionSchema
>;

export const sendMessageSchema = z.object({
	content: z
		.string()
		.min(1, "Message cannot be empty")
		.max(
			CHAT_LIMITS.MAX_MESSAGE_LENGTH,
			`Message cannot exceed ${CHAT_LIMITS.MAX_MESSAGE_LENGTH} characters`,
		),
});

export type SendMessageSchemaType = z.infer<typeof sendMessageSchema>;

export const updateChatSessionSchema = z.object({
	title: z.string().max(200).optional(),
	status: z
		.enum([CHAT_SESSION_STATUS.ACTIVE, CHAT_SESSION_STATUS.ARCHIVED])
		.optional(),
});

export type UpdateChatSessionSchemaType = z.infer<
	typeof updateChatSessionSchema
>;
