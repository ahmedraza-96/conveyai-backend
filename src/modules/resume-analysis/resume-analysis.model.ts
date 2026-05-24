import mongoose, { type Document, Schema } from "mongoose";

export interface KeywordMatch {
	keyword: string;
	found: boolean;
	context?: string;
}

export interface SectionScore {
	section: string;
	score: number;
	feedback: string;
	improvements: string[];
}

export interface ResumeAnalysisResult {
	overallScore: number;
	resumeQualityScore: number;
	atsCompatibilityScore: number;
	keywordAnalysis: {
		matchedKeywords: KeywordMatch[];
		missingKeywords: KeywordMatch[];
		matchPercentage: number;
	};
	sectionScores: SectionScore[];
	improvements: string[];
	summary: string;
}

export interface ResumeAnalysisDoc extends Document {
	userId: mongoose.Types.ObjectId;
	resumeUrl: string;
	jobDescription: string;
	status: "processing" | "completed" | "failed";
	result?: ResumeAnalysisResult;
	error?: string;
	createdAt: Date;
	updatedAt: Date;
}

const KeywordMatchSchema = new Schema<KeywordMatch>(
	{
		keyword: { type: String, required: true },
		found: { type: Boolean, required: true },
		context: { type: String },
	},
	{ _id: false },
);

const SectionScoreSchema = new Schema<SectionScore>(
	{
		section: { type: String, required: true },
		score: { type: Number, required: true },
		feedback: { type: String, required: true },
		improvements: [{ type: String }],
	},
	{ _id: false },
);

const ResumeAnalysisResultSchema = new Schema<ResumeAnalysisResult>(
	{
		overallScore: { type: Number, required: true },
		resumeQualityScore: { type: Number, required: true },
		atsCompatibilityScore: { type: Number, required: true },
		keywordAnalysis: {
			matchedKeywords: [KeywordMatchSchema],
			missingKeywords: [KeywordMatchSchema],
			matchPercentage: { type: Number, required: true },
		},
		sectionScores: [SectionScoreSchema],
		improvements: [{ type: String }],
		summary: { type: String, required: true },
	},
	{ _id: false },
);

const ResumeAnalysisSchema = new Schema<ResumeAnalysisDoc>(
	{
		userId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		resumeUrl: { type: String, required: true },
		jobDescription: { type: String, required: true },
		status: {
			type: String,
			required: true,
			enum: ["processing", "completed", "failed"],
			default: "processing",
		},
		result: { type: ResumeAnalysisResultSchema },
		error: { type: String },
	},
	{ timestamps: true },
);

const ResumeAnalysisModel = mongoose.model<ResumeAnalysisDoc>(
	"ResumeAnalysis",
	ResumeAnalysisSchema,
);

export default ResumeAnalysisModel;
