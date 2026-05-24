import type { Request, Response } from "express";
import { successResponse } from "../../utils/api.utils";
import type { JwtPayload } from "../../utils/auth.utils";
import type {
	CreateInterviewSchemaType,
	InterviewIdSchemaType,
	UpdateInterviewSchemaType,
} from "./interview.schema";
import {
	createInterview,
	deleteInterview,
	getInterviewById,
	getInterviewsByUser,
	updateInterview,
} from "./interview.service";

export const handleCreateInterview = async (
	req: Request<unknown, unknown, CreateInterviewSchemaType>,
	res: Response
) => {
	const userId = (req.user as JwtPayload).sub;
	const interview = await createInterview(req.body, userId);

	return successResponse(res, "Interview created successfully", interview);
};

export const handleGetMyInterviews = async (req: Request, res: Response) => {
	const userId = (req.user as JwtPayload).sub;
	const interviews = await getInterviewsByUser(userId);

	return successResponse(res, "Interviews retrieved successfully", interviews);
};

export const handleGetInterview = async (
	req: Request<InterviewIdSchemaType, unknown, unknown>,
	res: Response
) => {
	const { id } = req.params;
	const interview = await getInterviewById(id);

	if (!interview) {
		throw new Error("Interview not found");
	}

	return successResponse(res, "Interview retrieved successfully", interview);
};

export const handleUpdateInterview = async (
	req: Request<InterviewIdSchemaType, unknown, UpdateInterviewSchemaType>,
	res: Response
) => {
	const { id } = req.params;
	const interview = await updateInterview(id, req.body);

	if (!interview) {
		throw new Error("Interview not found");
	}

	return successResponse(res, "Interview updated successfully", interview);
};

export const handleDeleteInterview = async (
	req: Request<InterviewIdSchemaType, unknown, unknown>,
	res: Response
) => {
	const { id } = req.params;
	const deleted = await deleteInterview(id);

	if (!deleted) {
		throw new Error("Interview not found");
	}

	return successResponse(res, "Interview deleted successfully");
};
