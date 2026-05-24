import type { Request, Response } from "express";
import { successResponse } from "../../utils/api.utils";
import { getStats, getUsers, getVoiceInterviews } from "./admin.service";

export const handleGetStats = async (_req: Request, res: Response) => {
	const stats = await getStats();
	return successResponse(res, "Admin stats", { stats });
};

export const handleGetUsers = async (req: Request, res: Response) => {
	const page = Number(req.query.page) || 1;
	const limit = Number(req.query.limit) || 20;
	const result = await getUsers(page, limit);
	return successResponse(res, "Users", result);
};

export const handleGetVoiceInterviews = async (req: Request, res: Response) => {
	const page = Number(req.query.page) || 1;
	const limit = Number(req.query.limit) || 20;
	const result = await getVoiceInterviews(page, limit);
	return successResponse(res, "Voice interviews", result);
};
