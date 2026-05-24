import mongoose, { type Document, Schema } from "mongoose";
import {
	CHAT_ROLE,
	CHAT_SESSION_STATUS,
	CHAT_LIMITS,
} from "./chat.constants";

export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
	timestamp: Date;
}

export interface ChatSessionDoc extends Document {
	userId: mongoose.Types.ObjectId;
	title: string;
	status: string;
	messages: ChatMessage[];
	lastMessageAt: Date;
	createdAt: Date;
	updatedAt: Date;
}

const ChatMessageSchema = new Schema<ChatMessage>(
	{
		role: {
			type: String,
			required: true,
			enum: Object.values(CHAT_ROLE),
		},
		content: { type: String, required: true },
		timestamp: { type: Date, required: true, default: Date.now },
	},
	{ _id: false },
);

const ChatSessionSchema = new Schema<ChatSessionDoc>(
	{
		userId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		title: { type: String, required: true, default: "New Chat" },
		status: {
			type: String,
			required: true,
			enum: Object.values(CHAT_SESSION_STATUS),
			default: CHAT_SESSION_STATUS.ACTIVE,
		},
		messages: {
			type: [ChatMessageSchema],
			default: [],
			validate: {
				validator: (v: ChatMessage[]) =>
					v.length <= CHAT_LIMITS.MAX_MESSAGES_PER_SESSION,
				message: `Session cannot have more than ${CHAT_LIMITS.MAX_MESSAGES_PER_SESSION} messages`,
			},
		},
		lastMessageAt: { type: Date },
	},
	{ timestamps: true },
);

const ChatSessionModel = mongoose.model<ChatSessionDoc>(
	"ChatSession",
	ChatSessionSchema,
);

export default ChatSessionModel;
