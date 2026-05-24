import logger from "../lib/logger.service";
import { Queue } from "../lib/queue.server";
import {
	generateInterviewPrepQA,
	markPrepFailed,
	markPrepProcessing,
	savePrepResult,
} from "../modules/interview-preparation/interview-preparation.service";

export type InterviewPrepPayload = {
	userId: string;
	resumeUrl?: string;
	jobDescription?: string;
};

export const InterviewPrepQueue = Queue<InterviewPrepPayload>(
	"InterviewPrepQueue",
	async (job) => {
		const { userId, resumeUrl, jobDescription } = job.data;

		try {
			logger.info(
				{ userId, resumeUrl, jobDescription },
				"Starting interview preparation generation",
			);

			// Mark as PROCESSING
			await markPrepProcessing(userId, jobDescription, resumeUrl);

			// Generate Q&A pairs
			const items = await generateInterviewPrepQA({
				userId,
				resumeUrl,
				jobDescription,
			});

			// Save result
			await savePrepResult(userId, items);

			logger.info({ userId, itemCount: items.length }, "Interview preparation completed");

			return { success: true, itemCount: items.length };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";

			logger.error(
				{ userId, error: errorMessage },
				"Interview preparation failed",
			);

			// Mark as FAILED
			await markPrepFailed(userId, errorMessage);

			throw error;
		}
	},
);


