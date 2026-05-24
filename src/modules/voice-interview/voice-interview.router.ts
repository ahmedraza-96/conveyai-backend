import { canAccess } from "../../middlewares/can-access.middleware";
import MagicRouter from "../../openapi/magic-router";
import {
	handleCreate,
	handleDelete,
	handleEndSession,
	handleGetAnalytics,
	handleGetById,
	handleGetMy,
	handleRetryAnalysis,
	handleTavusWebhook,
	handleUpdateCallId,
	handleVapiWebhook,
	handleVoicePreview,
} from "./voice-interview.controller";
import { createVoiceInterviewSchema } from "./voice-interview.schema";

export const VOICE_INTERVIEW_ROUTER_ROOT = "/voice-interviews";

const voiceInterviewRouter = new MagicRouter(VOICE_INTERVIEW_ROUTER_ROOT);

// Create a new voice interview session
voiceInterviewRouter.post(
	"/",
	{ requestType: { body: createVoiceInterviewSchema } },
	canAccess(),
	handleCreate,
);

// Get all voice interview sessions for the current user
voiceInterviewRouter.get("/", {}, canAccess(), handleGetMy);

// Get analytics for the current user
voiceInterviewRouter.get("/analytics", {}, canAccess(), handleGetAnalytics);

// Update call ID after Vapi call starts
voiceInterviewRouter.patch(
	"/:id/call",
	{},
	canAccess(),
	handleUpdateCallId,
);

// End session and trigger analysis
voiceInterviewRouter.post(
	"/:id/end",
	{},
	canAccess(),
	handleEndSession,
);

// Retry failed analysis
voiceInterviewRouter.post(
	"/:id/retry-analysis",
	{},
	canAccess(),
	handleRetryAnalysis,
);

// Get a single voice interview session
voiceInterviewRouter.get("/:id", {}, canAccess(), handleGetById);

// Delete a voice interview session (owner only)
voiceInterviewRouter.delete("/:id", {}, canAccess(), handleDelete);

// Vapi webhook endpoint (no auth - verified by webhook secret)
voiceInterviewRouter.post("/webhook/vapi", {}, handleVapiWebhook);

// Tavus webhook endpoint (no auth - shutdown / transcription_ready events)
voiceInterviewRouter.post("/webhook/tavus", {}, handleTavusWebhook);

// Voice preview clip (no auth so the <audio> element can play it directly)
voiceInterviewRouter.get("/preview/:voiceId", {}, handleVoicePreview);

export default voiceInterviewRouter.getRouter();
