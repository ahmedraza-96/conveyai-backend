import mongoose, { type Document, Schema } from "mongoose";

export type InterviewQAItem = {
	id: number;
	category: "Technical" | "Behavioral" | "Soft Skills" | "General";
	question: string;
	answer: string;
	source: string;
};

export type InterviewPreparationStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface InterviewPreparationDoc extends Document {
	userId: mongoose.Types.ObjectId;
	status: InterviewPreparationStatus;
	items: InterviewQAItem[];
	jobDescription?: string;
	resumeUrl?: string;
	error?: string;
	createdAt: Date;
	updatedAt: Date;
}

const InterviewQAItemSchema = new Schema<InterviewQAItem>(
	{
		id: { type: Number, required: true },
		category: {
			type: String,
			required: true,
			enum: ["Technical", "Behavioral", "Soft Skills", "General"],
		},
		question: { type: String, required: true },
		answer: { type: String, required: true },
		source: { type: String, required: true },
	},
	{ _id: false },
);

const InterviewPreparationSchema = new Schema<InterviewPreparationDoc>(
	{
		userId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		status: {
			type: String,
			required: true,
			enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
			default: "PENDING",
		},
		items: {
			type: [InterviewQAItemSchema],
			default: [],
		},
		jobDescription: { type: String },
		resumeUrl: { type: String },
		error: { type: String },
	},
	{ timestamps: true },
);

const InterviewPreparationModel = mongoose.model<InterviewPreparationDoc>(
	"InterviewPreparation",
	InterviewPreparationSchema,
);

export default InterviewPreparationModel;


