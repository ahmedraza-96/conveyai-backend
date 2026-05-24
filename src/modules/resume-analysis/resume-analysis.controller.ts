import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { errorResponse, successResponse } from "../../utils/api.utils";
import type { JwtPayload } from "../../utils/auth.utils";
import type { AnalyzeResumeSchemaType } from "./resume-analysis.schema";
import {
	analyzeResume,
	getAnalysesByUser,
	getAnalysisById,
} from "./resume-analysis.service";

export const handleAnalyzeResume = async (
	req: Request<unknown, unknown, AnalyzeResumeSchemaType>,
	res: Response,
) => {
	try {
		const userId = (req.user as JwtPayload).sub;
		const { jobDescription } = req.body;

		const analysis = await analyzeResume(userId, jobDescription);

		return successResponse(
			res,
			"Resume analysis completed",
			{ analysis: analysis.toObject() },
			StatusCodes.CREATED,
		);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Analysis failed";
		return errorResponse(
			res,
			message,
			StatusCodes.INTERNAL_SERVER_ERROR,
		);
	}
};

export const handleGetMyAnalyses = async (req: Request, res: Response) => {
	const userId = (req.user as JwtPayload).sub;
	const analyses = await getAnalysesByUser(userId);

	return successResponse(res, "Resume analyses", {
		analyses,
	});
};

export const handleGetAnalysisById = async (
	req: Request<{ id: string }>,
	res: Response,
) => {
	const userId = (req.user as JwtPayload).sub;
	const analysis = await getAnalysisById(req.params.id, userId);

	if (!analysis) {
		return errorResponse(res, "Analysis not found", StatusCodes.NOT_FOUND);
	}

	return successResponse(res, "Resume analysis", {
		analysis: analysis.toObject(),
	});
};
