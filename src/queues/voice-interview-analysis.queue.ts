import logger from "../lib/logger.service";
import { Queue } from "../lib/queue.server";
import {
	generateAnalysis,
	saveAnalysis,
	fetchAndSaveCallData,
	transliterateToRomanUrdu,
} from "../modules/voice-interview/voice-interview.service";
import { VOICE_INTERVIEW_ANALYSIS_STATUS } from "../modules/voice-interview/voice-interview.constants";
import VoiceInterviewModel from "../modules/voice-interview/voice-interview.model";

export type VoiceInterviewAnalysisPayload = {
	sessionId: string;
};

export const VoiceInterviewAnalysisQueue =
	Queue<VoiceInterviewAnalysisPayload>(
		"VoiceInterviewAnalysisQueue",
		async (job) => {
			const { sessionId } = job.data;

			try {
				logger.info(
					{ sessionId, attempt: job.attemptsMade + 1 },
					"Starting voice interview analysis",
				);

				const session = await VoiceInterviewModel.findById(sessionId).exec();

				if (!session) {
					throw new Error(`Session not found: ${sessionId}`);
				}

				if (session.analysis) {
					logger.info(
						{ sessionId },
						"Analysis already exists, skipping",
					);
					return { success: true, skipped: true };
				}

				if (!session.transcript || session.transcript.length === 0) {
					logger.info(
						{ sessionId, attempt: job.attemptsMade + 1 },
						"Transcript empty, re-fetching from Vapi",
					);

					await fetchAndSaveCallData(session);
					const refreshedSession = await VoiceInterviewModel.findById(sessionId).exec();

					if (!refreshedSession?.transcript || refreshedSession.transcript.length === 0) {
						const maxAttempts = (job.opts?.attempts ?? 3);
						if (job.attemptsMade + 1 >= maxAttempts) {
							logger.warn(
								{ sessionId },
								"No transcript after all retry attempts, marking as failed",
							);
							await VoiceInterviewModel.findByIdAndUpdate(sessionId, {
								analysisStatus: VOICE_INTERVIEW_ANALYSIS_STATUS.FAILED,
								analysisError: "No transcript available for analysis",
							}).exec();
							return { success: false, reason: "no_transcript" };
						}

						throw new Error("Transcript not yet available from Vapi, will retry");
					}

					if (refreshedSession.language === "roman_urdu") {
						const transliterated = await transliterateToRomanUrdu(
							refreshedSession.transcript,
						);
						refreshedSession.transcript = transliterated;
						await VoiceInterviewModel.findByIdAndUpdate(sessionId, {
							transcript: transliterated,
						}).exec();
					}

					const analysis = await generateAnalysis(refreshedSession);
					await saveAnalysis(sessionId, analysis);

					logger.info(
						{ sessionId, score: analysis.overallScore },
						"Voice interview analysis completed (after transcript re-fetch)",
					);

					return { success: true, score: analysis.overallScore };
				}

				if (session.language === "roman_urdu") {
					const transliterated = await transliterateToRomanUrdu(
						session.transcript,
					);
					session.transcript = transliterated;
					await VoiceInterviewModel.findByIdAndUpdate(sessionId, {
						transcript: transliterated,
					}).exec();
				}

				const analysis = await generateAnalysis(session);
				await saveAnalysis(sessionId, analysis);

				logger.info(
					{ sessionId, score: analysis.overallScore },
					"Voice interview analysis completed",
				);

				return { success: true, score: analysis.overallScore };
			} catch (error) {
				const errorMessage =
					error instanceof Error
						? error.message
						: "Unknown error occurred";

				logger.error(
					{ sessionId, error: errorMessage, attempt: job.attemptsMade + 1 },
					"Voice interview analysis failed",
				);

				// On final attempt, mark session as failed
				const maxAttempts = (job.opts?.attempts ?? 3);
				if (job.attemptsMade + 1 >= maxAttempts) {
					await VoiceInterviewModel.findByIdAndUpdate(sessionId, {
						analysisStatus: VOICE_INTERVIEW_ANALYSIS_STATUS.FAILED,
						analysisError: errorMessage,
					}).exec();
					logger.warn(
						{ sessionId },
						"All analysis retry attempts exhausted, marked as failed",
					);
				}

				throw error;
			}
		},
		{
			defaultJobOptions: {
				attempts: 5,
				backoff: {
					type: "exponential",
					delay: 10000,
				},
			},
		},
	);
