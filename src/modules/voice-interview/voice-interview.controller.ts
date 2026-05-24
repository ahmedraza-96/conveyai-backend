import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { errorResponse, successResponse } from "../../utils/api.utils";
import type { JwtPayload } from "../../utils/auth.utils";
import type { CreateVoiceInterviewSchemaType } from "./voice-interview.schema";
import {
	createSession,
	deleteById,
	fetchAndSaveCallData,
	fetchAndSaveTavusCallData,
	getAnalytics,
	getById,
	getByUser,
	handleCallEnded,
	handleTavusConversationEnded,
	resetAnalysisStatus,
	updateSessionCallId,
} from "./voice-interview.service";
import { endTavusConversation } from "../../lib/tavus.service";
import { VOICE_INTERVIEW_ANALYSIS_STATUS } from "./voice-interview.constants";
import VoiceInterviewModel from "./voice-interview.model";
import { VoiceInterviewAnalysisQueue } from "../../queues/voice-interview-analysis.queue";
import logger from "../../lib/logger.service";
import { generateVoicePreview } from "./voice-preview.service";
import { getVoiceOption } from "./voice-options";

export const handleCreate = async (
	req: Request<unknown, unknown, CreateVoiceInterviewSchemaType>,
	res: Response,
) => {
	const userId = (req.user as JwtPayload).sub;
	const session = await createSession(req.body, userId);

	return successResponse(
		res,
		"Voice interview session created",
		{
			session: session.toObject(),
		},
		StatusCodes.CREATED,
	);
};

export const handleGetMy = async (req: Request, res: Response) => {
	const userId = (req.user as JwtPayload).sub;
	const sessions = await getByUser(userId);

	return successResponse(res, "Voice interview sessions", {
		sessions,
	});
};

export const handleGetById = async (
	req: Request<{ id: string }>,
	res: Response,
) => {
	const userId = (req.user as JwtPayload).sub;
	const session = await getById(req.params.id, userId);

	if (!session) {
		return errorResponse(res, "Session not found", StatusCodes.NOT_FOUND);
	}

	return successResponse(res, "Voice interview session", {
		session: session.toObject(),
	});
};

export const handleGetAnalytics = async (req: Request, res: Response) => {
	const userId = (req.user as JwtPayload).sub;
	const analytics = await getAnalytics(userId);

	return successResponse(res, "Voice interview analytics", {
		analytics,
	});
};

export const handleUpdateCallId = async (
	req: Request<{ id: string }, unknown, { vapiCallId: string }>,
	res: Response,
) => {
	const userId = (req.user as JwtPayload).sub;

	// Verify the session belongs to the user
	const existing = await getById(req.params.id, userId);
	if (!existing) {
		return errorResponse(res, "Session not found", StatusCodes.NOT_FOUND);
	}

	const session = await updateSessionCallId(req.params.id, req.body.vapiCallId);

	return successResponse(res, "Call ID updated", {
		session: session?.toObject(),
	});
};

export const handleVapiWebhook = async (req: Request, res: Response): Promise<void> => {
	try {
		const { message } = req.body;

		if (!message) {
			logger.warn("Webhook: Received request with no message body");
			res.status(200).json({ ok: true });
			return;
		}

		const messageType = message.type;
		logger.info(
			{ messageType },
			"Vapi webhook received",
		);

		if (messageType === "end-of-call-report") {
			const {
				call,
				transcript: rawTranscript,
				recordingUrl,
			} = message;

			const callId = call?.id;
			const assistantId = call?.assistantId;
			const duration = call?.duration;

			logger.info(
				{
					callId,
					assistantId,
					hasTranscript: Array.isArray(rawTranscript),
					transcriptLength: Array.isArray(rawTranscript) ? rawTranscript.length : 0,
					hasRecordingUrl: !!recordingUrl,
					duration,
				},
				"Webhook end-of-call-report details",
			);

			if (!callId && !assistantId) {
				logger.warn("Webhook: No callId or assistantId in end-of-call-report");
				res.status(200).json({ ok: true });
				return;
			}

			// Parse transcript from Vapi format
			const transcript: Array<{
				role: "assistant" | "user";
				content: string;
				timestamp: number;
			}> = [];

			if (Array.isArray(rawTranscript)) {
				for (const entry of rawTranscript) {
					transcript.push({
						role: entry.role === "assistant" ? "assistant" : "user",
						content: entry.text || entry.message || "",
						timestamp: entry.secondsFromStart || 0,
					});
				}
			}

			logger.info(
				{ parsedTranscriptCount: transcript.length, lookupId: assistantId || callId },
				"Webhook: Parsed transcript, looking up session",
			);

			const session = await handleCallEnded(
				assistantId || callId,
				transcript,
				recordingUrl,
				duration,
			);

			if (session && session._id) {
				// Set analysis status to pending and enqueue analysis job
				await VoiceInterviewModel.findByIdAndUpdate(session._id, {
					analysisStatus: VOICE_INTERVIEW_ANALYSIS_STATUS.PENDING,
				}).exec();
				await VoiceInterviewAnalysisQueue.add("analyze", {
					sessionId: String(session._id),
				});
				logger.info(
					{ sessionId: session._id, transcriptCount: transcript.length },
					"Analysis job enqueued after call ended",
				);
			} else {
				logger.warn(
					{ assistantId, callId },
					"Webhook: No matching session found for end-of-call-report",
				);
			}
		} else if (messageType === "status-update") {
			const { status, call } = message;
			logger.info(
				{ callId: call?.id, status: status?.status },
				"Vapi call status update",
			);
		}

		res.status(200).json({ ok: true });
	} catch (error) {
		logger.error(
			{ error: (error as Error).message, stack: (error as Error).stack },
			"Error processing Vapi webhook",
		);
		res.status(200).json({ ok: true });
	}
};

export const handleTavusWebhook = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const payload = req.body as
			| {
					event_type?: string;
					message_type?: string;
					conversation_id?: string;
					properties?: Record<string, unknown>;
			  }
			| undefined;

		const eventType = payload?.event_type || payload?.message_type;
		const conversationId = payload?.conversation_id;

		logger.info({ eventType, conversationId }, "Tavus webhook received");

		if (!conversationId) {
			res.status(200).json({ ok: true });
			return;
		}

		const isShutdown =
			eventType === "system.shutdown" ||
			eventType === "application.shutdown" ||
			eventType === "application.transcription_ready" ||
			eventType === "conversation.ended";

		if (isShutdown) {
			const session = await handleTavusConversationEnded(conversationId);
			if (
				session &&
				session._id &&
				Array.isArray(session.transcript) &&
				session.transcript.length > 0 &&
				!session.analysis
			) {
				await VoiceInterviewModel.findByIdAndUpdate(session._id, {
					analysisStatus: VOICE_INTERVIEW_ANALYSIS_STATUS.PENDING,
				}).exec();
				await VoiceInterviewAnalysisQueue.add("analyze", {
					sessionId: String(session._id),
				});
				logger.info(
					{ sessionId: session._id, conversationId },
					"Analysis enqueued after Tavus shutdown",
				);
			}
		}

		res.status(200).json({ ok: true });
	} catch (error) {
		logger.error(
			{ error: (error as Error).message },
			"Error processing Tavus webhook",
		);
		res.status(200).json({ ok: true });
	}
};

export const handleEndSession = async (
	req: Request<{ id: string }>,
	res: Response,
) => {
	const userId = (req.user as JwtPayload).sub;
	const session = await getById(req.params.id, userId);

	if (!session) {
		return errorResponse(res, "Session not found", StatusCodes.NOT_FOUND);
	}

	// Fetch transcript — branch on provider. Tavus avatar sessions don't have
	// a Vapi call ID; pull transcript from Tavus instead.
	let updatedSession;
	if (session.useAvatar && session.tavusConversationId) {
		// Tell Tavus to tear down the room (idempotent — safe if already ended)
		await endTavusConversation(session.tavusConversationId);
		updatedSession = await fetchAndSaveTavusCallData(session);
	} else {
		updatedSession = await fetchAndSaveCallData(session);
	}
	const finalSession = updatedSession || session;

	// Enqueue analysis if we have transcript
	if (
		finalSession.transcript &&
		finalSession.transcript.length > 0 &&
		!finalSession.analysis
	) {
		await VoiceInterviewModel.findByIdAndUpdate(finalSession._id, {
			analysisStatus: VOICE_INTERVIEW_ANALYSIS_STATUS.PENDING,
		}).exec();
		await VoiceInterviewAnalysisQueue.add("analyze", {
			sessionId: String(finalSession._id),
		});
		logger.info(
			{ sessionId: finalSession._id },
			"Analysis enqueued after session end",
		);
	}

	// Re-fetch to include the updated analysisStatus
	const sessionWithStatus = await getById(req.params.id, userId);

	return successResponse(res, "Session ended, analysis enqueued", {
		session: (sessionWithStatus || finalSession).toObject(),
	});
};

export const handleDelete = async (
	req: Request<{ id: string }>,
	res: Response,
) => {
	const userId = (req.user as JwtPayload).sub;
	const deleted = await deleteById(req.params.id, userId);

	if (!deleted) {
		return errorResponse(res, "Session not found", StatusCodes.NOT_FOUND);
	}

	logger.info(
		{ sessionId: req.params.id, userId },
		"Voice interview deleted by user",
	);

	return successResponse(res, "Voice interview deleted", {
		id: String(deleted._id),
	});
};

export const handleVoicePreview = async (
	req: Request<{ voiceId: string }>,
	res: Response,
) => {
	const { voiceId } = req.params;
	if (!getVoiceOption(voiceId)) {
		return errorResponse(res, "Unknown voice id", StatusCodes.NOT_FOUND);
	}
	try {
		const audio = await generateVoicePreview(voiceId);
		res.setHeader("Content-Type", "audio/mpeg");
		res.setHeader("Content-Length", String(audio.length));
		res.setHeader("Cache-Control", "public, max-age=86400, immutable");
		res.status(StatusCodes.OK).end(audio);
		return;
	} catch (error) {
		return errorResponse(
			res,
			(error as Error).message || "Failed to generate preview",
			StatusCodes.SERVICE_UNAVAILABLE,
		);
	}
};

export const handleRetryAnalysis = async (
	req: Request<{ id: string }>,
	res: Response,
) => {
	const userId = (req.user as JwtPayload).sub;
	const session = await getById(req.params.id, userId);

	if (!session) {
		return errorResponse(res, "Session not found", StatusCodes.NOT_FOUND);
	}

	if (session.analysisStatus !== VOICE_INTERVIEW_ANALYSIS_STATUS.FAILED) {
		return errorResponse(
			res,
			"Analysis can only be retried for failed sessions",
			StatusCodes.BAD_REQUEST,
		);
	}

	// Try to fetch transcript from Vapi if it's still empty
	if (!session.transcript || session.transcript.length === 0) {
		logger.info(
			{ sessionId: session._id },
			"Retry: transcript empty, attempting to fetch from Vapi before re-enqueuing",
		);
		await fetchAndSaveCallData(session);
	}

	// Reset status and re-enqueue
	const updated = await resetAnalysisStatus(String(session._id));
	await VoiceInterviewAnalysisQueue.add("analyze", {
		sessionId: String(session._id),
	});

	logger.info(
		{ sessionId: session._id },
		"Analysis retry enqueued",
	);

	return successResponse(res, "Analysis retry enqueued", {
		session: updated?.toObject(),
	});
};
