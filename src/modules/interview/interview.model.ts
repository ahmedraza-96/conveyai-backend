import mongoose, { Schema, Document } from "mongoose";
import { INTERVIEW_STATUS, INTERVIEW_TYPES, InterviewStatus, InterviewType } from "./interview.constants";

export interface InterviewType {
	_id: string;
	title: string;
	description?: string;
	type: InterviewType;
	duration: number; // in minutes
	questions: string[];
	status: InterviewStatus;
	createdBy: mongoose.Types.ObjectId;
	candidateId?: mongoose.Types.ObjectId;
	startedAt?: Date;
	completedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

const InterviewSchema = new Schema<InterviewType>(
	{
		title: { type: String, required: true },
		description: { type: String },
		type: {
			type: String,
			required: true,
			enum: Object.values(INTERVIEW_TYPES),
		},
		duration: { type: Number, required: true },
		questions: [{ type: String, required: true }],
		status: {
			type: String,
			required: true,
			enum: Object.values(INTERVIEW_STATUS),
			default: INTERVIEW_STATUS.CREATED,
		},
		createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
		candidateId: { type: Schema.Types.ObjectId, ref: "User" },
		startedAt: { type: Date },
		completedAt: { type: Date },
	},
	{ timestamps: true }
);

export interface IInterviewDocument extends Document, InterviewType {}
const Interview = mongoose.model<InterviewType>("Interview", InterviewSchema);
export default Interview;
