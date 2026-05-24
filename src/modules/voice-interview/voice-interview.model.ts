import mongoose, { type Document, Schema } from "mongoose";
import {
	LANGUAGES,
	VOICE_INTERVIEW_ANALYSIS_STATUS,
	VOICE_INTERVIEW_DIFFICULTY,
	VOICE_INTERVIEW_MODE,
	VOICE_INTERVIEW_STATUS,
	VOICE_INTERVIEW_TYPE,
	VOICE_PERSONALITY_PRESETS,
} from "./voice-interview.constants";

export interface TranscriptEntry {
	role: "assistant" | "user";
	content: string;
	timestamp: number;
}

export interface SkillScore {
	skill: string;
	score: number;
	feedback: string;
}

export interface RubricEvidence {
	quote: string;
	timestamp?: number;
	rationale: string;
}

export type RubricDimensionId =
	| "technical_accuracy"
	| "communication_clarity"
	| "structured_thinking"
	| "confidence_delivery"
	| "role_alignment";

export interface RubricDimensionScore {
	dimension: RubricDimensionId;
	score: number; // 0-4
	weight: number; // 0..1, snapshot of the weight used at scoring time
	anchorLabel: string; // e.g. "Strong"
	feedback: string;
	evidence: RubricEvidence[];
}

export interface FillerWordStats {
	word: string;
	count: number;
	percentage: number;
}

export interface SpeechAnalytics {
	totalWords: number;
	totalUserMessages: number;
	averageWordsPerResponse: number;
	wordsPerMinute: number;
	vocabularyRichness: number;
	uniqueWordCount: number;
	fillerWords: FillerWordStats[];
	totalFillerCount: number;
	fillerPercentage: number;
	longestResponse: number;
	shortestResponse: number;
	averageResponseTimeSec: number;
	responseTimes: number[];
	pauseGaps: number[];
	averagePauseGapSec: number;
}

export interface QuestionAnalysis {
	questionIndex: number;
	question: string;
	userAnswer: string;
	idealAnswer: string;
	similarityScore: number;
	missingPoints: string[];
	strengths: string[];
	feedback: string;
}

export interface InterviewAnalysis {
	overallScore: number;
	strengths: string[];
	weaknesses: string[];
	communicationFeedback: string;
	technicalFeedback: string;
	skillScores?: SkillScore[];
	rubricVersion?: string;
	rubricScores?: RubricDimensionScore[];
	recommendations: string[];
	summary: string;
	speechAnalytics?: SpeechAnalytics;
	questionAnalysis?: QuestionAnalysis[];
}

export interface VoiceInterviewDoc extends Document {
	userId: mongoose.Types.ObjectId;
	mode: string;
	interviewType: string;
	status: string;
	duration: number;
	difficulty: string;
	topic?: string;
	resumeUrl?: string;
	jobDescription?: string;
	vapiCallId?: string;
	vapiAssistantId?: string;
	tavusConversationId?: string;
	tavusConversationUrl?: string;
	transcript: TranscriptEntry[];
	recordingUrl?: string;
	actualDuration?: number;
	analysis?: InterviewAnalysis;
	analysisStatus?: string;
	analysisError?: string;
	personality?: string;
	customInstructions?: string;
	isAdaptive?: boolean;
	language?: string;
	useAvatar?: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const TranscriptEntrySchema = new Schema<TranscriptEntry>(
	{
		role: { type: String, required: true, enum: ["assistant", "user"] },
		content: { type: String, required: true },
		timestamp: { type: Number, required: true },
	},
	{ _id: false },
);

const SkillScoreSchema = new Schema<SkillScore>(
	{
		skill: { type: String, required: true },
		score: { type: Number, required: true },
		feedback: { type: String, required: true },
	},
	{ _id: false },
);

const RubricEvidenceSchema = new Schema<RubricEvidence>(
	{
		quote: { type: String, required: true },
		timestamp: { type: Number },
		rationale: { type: String, required: true },
	},
	{ _id: false },
);

const RubricDimensionScoreSchema = new Schema<RubricDimensionScore>(
	{
		dimension: {
			type: String,
			required: true,
			enum: [
				"technical_accuracy",
				"communication_clarity",
				"structured_thinking",
				"confidence_delivery",
				"role_alignment",
			],
		},
		score: { type: Number, required: true, min: 0, max: 4 },
		weight: { type: Number, required: true },
		anchorLabel: { type: String, required: true },
		feedback: { type: String, required: true },
		evidence: { type: [RubricEvidenceSchema], default: [] },
	},
	{ _id: false },
);

const FillerWordStatsSchema = new Schema<FillerWordStats>(
	{
		word: { type: String, required: true },
		count: { type: Number, required: true },
		percentage: { type: Number, required: true },
	},
	{ _id: false },
);

const SpeechAnalyticsSchema = new Schema<SpeechAnalytics>(
	{
		totalWords: { type: Number, required: true },
		totalUserMessages: { type: Number, required: true },
		averageWordsPerResponse: { type: Number, required: true },
		wordsPerMinute: { type: Number, required: true },
		vocabularyRichness: { type: Number, required: true },
		uniqueWordCount: { type: Number, required: true },
		fillerWords: [FillerWordStatsSchema],
		totalFillerCount: { type: Number, required: true },
		fillerPercentage: { type: Number, required: true },
		longestResponse: { type: Number, required: true },
		shortestResponse: { type: Number, required: true },
		averageResponseTimeSec: { type: Number, required: true },
		responseTimes: [{ type: Number }],
		pauseGaps: [{ type: Number }],
		averagePauseGapSec: { type: Number, required: true },
	},
	{ _id: false },
);

const QuestionAnalysisSchema = new Schema<QuestionAnalysis>(
	{
		questionIndex: { type: Number, required: true },
		question: { type: String, required: true },
		userAnswer: { type: String, required: true },
		idealAnswer: { type: String, required: true },
		similarityScore: { type: Number, required: true },
		missingPoints: [{ type: String }],
		strengths: [{ type: String }],
		feedback: { type: String, required: true },
	},
	{ _id: false },
);

const InterviewAnalysisSchema = new Schema<InterviewAnalysis>(
	{
		overallScore: { type: Number, required: true },
		strengths: [{ type: String }],
		weaknesses: [{ type: String }],
		communicationFeedback: { type: String, required: true },
		technicalFeedback: { type: String, required: true },
		skillScores: { type: [SkillScoreSchema], default: undefined },
		rubricVersion: { type: String },
		rubricScores: { type: [RubricDimensionScoreSchema], default: undefined },
		recommendations: [{ type: String }],
		summary: { type: String, required: true },
		speechAnalytics: { type: SpeechAnalyticsSchema },
		questionAnalysis: [QuestionAnalysisSchema],
	},
	{ _id: false },
);

const VoiceInterviewSchema = new Schema<VoiceInterviewDoc>(
	{
		userId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		mode: {
			type: String,
			required: true,
			enum: Object.values(VOICE_INTERVIEW_MODE),
		},
		interviewType: {
			type: String,
			required: true,
			enum: Object.values(VOICE_INTERVIEW_TYPE),
		},
		status: {
			type: String,
			required: true,
			enum: Object.values(VOICE_INTERVIEW_STATUS),
			default: VOICE_INTERVIEW_STATUS.CREATED,
		},
		duration: { type: Number, required: true },
		difficulty: {
			type: String,
			required: true,
			enum: Object.values(VOICE_INTERVIEW_DIFFICULTY),
		},
		topic: { type: String },
		resumeUrl: { type: String },
		jobDescription: { type: String },
		vapiCallId: { type: String },
		vapiAssistantId: { type: String },
		tavusConversationId: { type: String, index: true },
		tavusConversationUrl: { type: String },
		transcript: { type: [TranscriptEntrySchema], default: [] },
		recordingUrl: { type: String },
		actualDuration: { type: Number },
		analysis: { type: InterviewAnalysisSchema },
		analysisStatus: {
			type: String,
			enum: Object.values(VOICE_INTERVIEW_ANALYSIS_STATUS),
		},
		analysisError: { type: String },
		personality: {
			type: String,
			enum: VOICE_PERSONALITY_PRESETS.map((p) => p.id),
		},
		customInstructions: { type: String },
		isAdaptive: { type: Boolean, default: false },
		language: {
			type: String,
			enum: LANGUAGES,
			default: "english",
		},
		useAvatar: { type: Boolean, default: false },
	},
	{ timestamps: true },
);

const VoiceInterviewModel = mongoose.model<VoiceInterviewDoc>(
	"VoiceInterview",
	VoiceInterviewSchema,
);

export default VoiceInterviewModel;
