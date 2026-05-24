import mongoose from "mongoose";
import logger from "../../lib/logger.service";
import { callLLM } from "../../lib/llm.service";
import { getUserById } from "../user/user.services";
import {
	extractResumeText,
	fetchResumeBuffer,
} from "../interview-preparation/resume-parser";
import ResumeAnalysisModel, {
	type ResumeAnalysisDoc,
	type ResumeAnalysisResult,
} from "./resume-analysis.model";

export const analyzeResume = async (
	userId: string,
	jobDescription: string,
): Promise<ResumeAnalysisDoc> => {
	const user = await getUserById(userId);

	if (!user.resume) {
		throw new Error(
			"No resume found. Please upload a resume in your profile settings.",
		);
	}

	// Create the analysis record in processing state
	const analysis = await ResumeAnalysisModel.create({
		userId: new mongoose.Types.ObjectId(userId),
		resumeUrl: user.resume,
		jobDescription,
		status: "processing",
	});

	try {
		// Parse resume text
		let resumeText = "";
		const extension = user.resume.toLowerCase().split(".").pop();
		if (extension === "pdf") {
			resumeText = await extractResumeText(
				user.resume,
				Buffer.alloc(0),
				user.resume,
			);
		} else {
			const buffer = await fetchResumeBuffer(user.resume);
			resumeText = await extractResumeText(user.resume, buffer);
		}

		if (!resumeText || resumeText.trim().length < 10) {
			throw new Error("Could not extract text from resume");
		}

		const prompt = `You are an expert ATS (Applicant Tracking System) analyzer and career coach. Analyze the following resume against the provided job description.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Provide a comprehensive analysis as a JSON object (no markdown, no code fences, ONLY valid JSON):
{
  "overallScore": <number 0-100>,
  "resumeQualityScore": <number 0-100, how well-structured and written the resume is>,
  "atsCompatibilityScore": <number 0-100, how well an ATS would parse this resume>,
  "keywordAnalysis": {
    "matchedKeywords": [{"keyword": "<keyword from JD found in resume>", "found": true, "context": "<where it appears>"}],
    "missingKeywords": [{"keyword": "<important keyword from JD NOT in resume>", "found": false}],
    "matchPercentage": <number 0-100>
  },
  "sectionScores": [
    {
      "section": "<section name e.g. Contact Info, Summary, Experience, Education, Skills, Projects>",
      "score": <number 0-100>,
      "feedback": "<specific feedback for this section>",
      "improvements": ["<specific improvement suggestion>"]
    }
  ],
  "improvements": [
    "<high-priority improvement recommendation>"
  ],
  "summary": "<2-3 sentence overall assessment of resume-JD fit>"
}

Scoring guidelines:
- 90-100: Excellent match, highly likely to pass ATS
- 75-89: Good match with minor gaps
- 60-74: Moderate match, several improvements needed
- Below 60: Significant gaps, major revisions recommended

Be specific and actionable in your feedback. Identify ALL relevant keywords from the job description.`;

		const responseText = await callLLM(prompt);

		const cleaned = responseText
			.replace(/```json/gi, "")
			.replace(/```/g, "")
			.replace(/\u201c|\u201d/g, '"')
			.trim();

		let result: ResumeAnalysisResult;
		try {
			result = JSON.parse(cleaned) as ResumeAnalysisResult;
		} catch {
			const match = cleaned.match(/\{[\s\S]*\}/);
			if (match) {
				result = JSON.parse(match[0]) as ResumeAnalysisResult;
			} else {
				throw new Error("Failed to parse analysis result");
			}
		}

		const updated = await ResumeAnalysisModel.findByIdAndUpdate(
			analysis._id,
			{
				status: "completed",
				result,
			},
			{ new: true },
		).exec();

		logger.info(
			{ analysisId: analysis._id, overallScore: result.overallScore },
			"Resume analysis completed",
		);

		return updated!;
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		await ResumeAnalysisModel.findByIdAndUpdate(analysis._id, {
			status: "failed",
			error: errorMessage,
		}).exec();

		logger.error(
			{ analysisId: analysis._id, error: errorMessage },
			"Resume analysis failed",
		);

		throw error;
	}
};

export const getAnalysesByUser = async (
	userId: string,
): Promise<ResumeAnalysisDoc[]> => {
	return ResumeAnalysisModel.find({
		userId: new mongoose.Types.ObjectId(userId),
	})
		.sort({ createdAt: -1 })
		.exec();
};

export const getAnalysisById = async (
	id: string,
	userId: string,
): Promise<ResumeAnalysisDoc | null> => {
	return ResumeAnalysisModel.findOne({
		_id: id,
		userId: new mongoose.Types.ObjectId(userId),
	}).exec();
};
