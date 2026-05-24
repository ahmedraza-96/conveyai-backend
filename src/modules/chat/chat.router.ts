import { canAccess } from "../../middlewares/can-access.middleware";
import MagicRouter from "../../openapi/magic-router";
import {
	handleCreateSession,
	handleGetSessions,
	handleGetSessionById,
	handleUpdateSession,
	handleDeleteSession,
	handleSendMessage,
	handleSendMessageStream,
} from "./chat.controller";
import {
	createChatSessionSchema,
	sendMessageSchema,
	updateChatSessionSchema,
} from "./chat.schema";
import { chatRateLimit } from "./chat.ratelimit";

export const CHAT_ROUTER_ROOT = "/chat-sessions";

const chatRouter = new MagicRouter(CHAT_ROUTER_ROOT);

// Create a new chat session
chatRouter.post(
	"/",
	{ requestType: { body: createChatSessionSchema } },
	canAccess(),
	handleCreateSession,
);

// Get all chat sessions for the current user
chatRouter.get("/", {}, canAccess(), handleGetSessions);

// Get a single chat session with messages
chatRouter.get("/:id", {}, canAccess(), handleGetSessionById);

// Update session title or status
chatRouter.patch(
	"/:id",
	{ requestType: { body: updateChatSessionSchema } },
	canAccess(),
	handleUpdateSession,
);

// Delete a chat session
chatRouter.delete("/:id", {}, canAccess(), handleDeleteSession);

// Send a message (streaming SSE response)
chatRouter.post(
	"/:id/messages/stream",
	{ requestType: { body: sendMessageSchema } },
	canAccess(),
	chatRateLimit,
	handleSendMessageStream,
);

// Send a message (non-streaming fallback)
chatRouter.post(
	"/:id/messages",
	{ requestType: { body: sendMessageSchema } },
	canAccess(),
	chatRateLimit,
	handleSendMessage,
);

export default chatRouter.getRouter();
