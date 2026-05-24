export const CHAT_ROLE = {
	USER: "user",
	ASSISTANT: "assistant",
} as const;

export type ChatRole = (typeof CHAT_ROLE)[keyof typeof CHAT_ROLE];

export const CHAT_SESSION_STATUS = {
	ACTIVE: "active",
	ARCHIVED: "archived",
} as const;

export type ChatSessionStatus =
	(typeof CHAT_SESSION_STATUS)[keyof typeof CHAT_SESSION_STATUS];

export const CHAT_LIMITS = {
	MAX_MESSAGES_PER_SESSION: 50,
	MAX_SESSIONS_PER_USER: 50,
	MAX_MESSAGE_LENGTH: 4000,
	RATE_LIMIT_PER_MINUTE: 15,
	CONTEXT_MESSAGE_COUNT: 30,
} as const;
