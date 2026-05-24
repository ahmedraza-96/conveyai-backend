import mongoose from "mongoose";
import Interview, { IInterviewDocument } from "./interview.model";
import type { CreateInterviewSchemaType, UpdateInterviewSchemaType } from "./interview.schema";
import { INTERVIEW_STATUS } from "./interview.constants";

export const createInterview = async (
	data: CreateInterviewSchemaType,
	createdBy: string
): Promise<IInterviewDocument> => {
	const interview = new Interview({
		...data,
		createdBy: new mongoose.Types.ObjectId(createdBy),
		status: INTERVIEW_STATUS.CREATED,
	});

	return await interview.save();
};

export const getInterviewsByUser = async (userId: string): Promise<IInterviewDocument[]> => {
	return await Interview.find({ createdBy: userId }).sort({ createdAt: -1 });
};

export const getInterviewById = async (id: string): Promise<IInterviewDocument | null> => {
	return await Interview.findById(id).populate('createdBy', 'name email');
};

export const updateInterview = async (
	id: string,
	data: UpdateInterviewSchemaType
): Promise<IInterviewDocument | null> => {
	return await Interview.findByIdAndUpdate(id, data, { new: true });
};

export const deleteInterview = async (id: string): Promise<boolean> => {
	const result = await Interview.findByIdAndDelete(id);
	return !!result;
};

