import type { Request, Response } from "express";
import { successResponse } from "../../utils/api.utils";
import type { JwtPayload } from "../../utils/auth.utils";
import type { TestGeminiSchemaType } from "./interview-preparation.schema";
import { getLatestPrep, testGeminiAPI } from "./interview-preparation.service";

export const handleTestGemini = async (
	req: Request<unknown, unknown, TestGeminiSchemaType>,
	res: Response,
) => {
	const result = await testGeminiAPI(req.body);

	return successResponse(res, "Gemini API test successful", result);
};

export const handleGetLatestInterviewPrep = async (
	req: Request,
	res: Response,
) => {
	const userId = (req.user as JwtPayload).sub;
	const record = await getLatestPrep(userId);

	return successResponse(res, "Latest interview prep", { record: record ?? null });
};

