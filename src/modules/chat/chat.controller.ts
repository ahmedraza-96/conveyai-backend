import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { errorResponse, successResponse } from "../../utils/api.utils";
import type { JwtPayload } from "../../utils/auth.utils";
import type {
	CreateChatSessionSchemaType,
	SendMessageSchemaType,
	UpdateChatSessionSchemaType,
} from "./chat.schema";
import {
	createSession,
	getSessions,
	getSessionById,
	updateSession,
	deleteSession,
	sendMessage,
	sendMessageStream,
} from "./chat.service";
import logger from "../../lib/logger.service";

export const handleCreateSession = async (
	req: Request<unknown, unknown, CreateChatSessionSchemaType>,
	res: Response,
) => {
	const userId = (req.user as JwtPayload).sub;
	const session = await createSession(userId, req.body.title);

	return successResponse(
		res,
		"Chat session created",
		{ session: session.toObject() },
		StatusCodes.CREATED,
	);
};

export const handleGetSessions = async (req: Request, res: Response) => {
	const userId = (req.user as JwtPayload).sub;
	const sessions = await getSessions(userId);

	return successResponse(res, "Chat sessions", { sessions });
};

export const handleGetSessionById = async (
	req: Request<{ id: string }>,
	res: Response,
) => {
	const userId = (req.user as JwtPayload).sub;
	const session = await getSessionById(req.params.id, userId);

	if (!session) {
		return errorResponse(res, "Session not found", StatusCodes.NOT_FOUND);
	}

	return successResponse(res, "Chat session", { session });
};

export const handleUpdateSession = async (
	req: Request<{ id: string }, unknown, UpdateChatSessionSchemaType>,
	res: Response,
) => {
	const userId = (req.user as JwtPayload).sub;
	const session = await updateSession(req.params.id, userId, req.body);

	if (!session) {
		return errorResponse(res, "Session not found", StatusCodes.NOT_FOUND);
	}

	return successResponse(res, "Session updated", { session });
};

export const handleDeleteSession = async (
	req: Request<{ id: string }>,
	res: Response,
) => {
	const userId = (req.user as JwtPayload).sub;
	const deleted = await deleteSession(req.params.id, userId);

	if (!deleted) {
		return errorResponse(res, "Session not found", StatusCodes.NOT_FOUND);
	}

	return successResponse(res, "Session deleted", {});
};

export const handleSendMessage = async (
	req: Request<{ id: string }, unknown, SendMessageSchemaType>,
	res: Response,
) => {
	try {
		const userId = (req.user as JwtPayload).sub;
		const { userMessage, assistantMessage } = await sendMessage(
			req.params.id,
			userId,
			req.body.content,
		);

		return successResponse(res, "Message sent", {
			userMessage,
			assistantMessage,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to send message";
		logger.error({ error: message }, "Chat message error");
		return errorResponse(
			res,
			message,
			message.includes("not found")
				? StatusCodes.NOT_FOUND
				: StatusCodes.INTERNAL_SERVER_ERROR,
		);
	}
};

export const handleSendMessageStream = async (
	req: Request<{ id: string }, unknown, SendMessageSchemaType>,
	res: Response,
) => {
	const userId = (req.user as JwtPayload).sub;

	// Set up SSE headers
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");
	res.setHeader("X-Accel-Buffering", "no");
	res.flushHeaders();

	try {
		const { assistantContent } = await sendMessageStream(
			req.params.id,
			userId,
			req.body.content,
			(chunk: string) => {
				res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
			},
		);

		// Send completion event
		res.write(
			`data: ${JSON.stringify({ type: "done", content: assistantContent })}\n\n`,
		);
		res.end();
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Stream failed";
		logger.error({ error: message }, "Chat stream error");

		res.write(
			`data: ${JSON.stringify({ type: "error", content: message })}\n\n`,
		);
		res.end();
	}
};
