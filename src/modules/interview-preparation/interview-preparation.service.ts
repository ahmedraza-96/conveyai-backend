import mongoose from "mongoose";
import logger from "../../lib/logger.service";
import { callLLM } from "../../lib/llm.service";
import type { TestGeminiSchemaType } from "./interview-preparation.schema";
import InterviewPreparationModel, {
	type InterviewPreparationDoc,
	type InterviewQAItem,
} from "./interview-preparation.model";
import { extractResumeText, fetchResumeBuffer } from "./resume-parser";

export type GeneratedQAItem = InterviewQAItem;

export const testGeminiAPI = async (
	payload: TestGeminiSchemaType,
): Promise<{ response: string }> => {
	const responseText = await callLLM(payload.prompt);
	return { response: responseText };
};

type PrepJobInput = {
	userId: string;
	resumeUrl?: string;
	jobDescription?: string;
};

export const generateInterviewPrepQA = async (
	payload: PrepJobInput,
): Promise<GeneratedQAItem[]> => {
	const { resumeUrl, jobDescription } = payload;

	let resumeText = "";
	if (resumeUrl) {
		// For PDF files, pass URL directly to PDFParse (more efficient)
		// For DOCX files, we still need to fetch the buffer
		const extension = resumeUrl.toLowerCase().split(".").pop();
		if (extension === "pdf") {
			// Use URL directly for PDF
			resumeText = await extractResumeText(resumeUrl, Buffer.alloc(0), resumeUrl);
		} else {
			// For DOCX/DOC, fetch buffer first
			const buffer = await fetchResumeBuffer(resumeUrl);
			resumeText = await extractResumeText(resumeUrl, buffer);
		}
	}

	const prompt = buildPrompt(resumeText, jobDescription);
	const responseText = await callLLM(prompt);

	const parsedItems = parseGeminiResponseToItems(responseText);

	return parsedItems;
};

const buildPrompt = (resumeText: string, jobDescription?: string): string => {
	return `
You are an interview coach. Using the resume content and job description, generate 10-12 interview preparation question-answer pairs.

Rules:
- Output ONLY valid JSON (no markdown, no prose) as an array of objects.
- Each object must have: id (1..n), category ("Technical" | "Behavioral" | "Soft Skills" | "General"), question, answer, source (URL).
- Answers concise (<=80 words) and specific to the resume + job description.
- Include credible sources/links per item when possible.

Resume Content:
${resumeText || "Not provided"}

Job Description:
${jobDescription || "Not provided"}
`;
};

/**
 * Attempts to parse Gemini free-form response text into a structured list of QA items.
 * Handles JSON code fences and common formatting issues, and falls back to a single
 * item with the raw response if parsing is impossible.
 */
const parseGeminiResponseToItems = (responseText: string): GeneratedQAItem[] => {
	// Quick normalization: strip code fences and smart quotes that break JSON.parse
	const cleaned = responseText
		.replace(/```json/gi, "")
		.replace(/```/g, "")
		.replace(/\u201c|\u201d/g, '"')
		.trim();

	const tryParse = (text: string): unknown => {
		try {
			return JSON.parse(text);
		} catch {
			return null;
		}
	};

	// First attempt: direct parse
	let parsed = tryParse(cleaned);

	// Second attempt: extract JSON array substring if direct parse fails
	if (!parsed) {
		const match = cleaned.match(/\[[\s\S]*\]/);
		if (match) {
			parsed = tryParse(match[0]);
		}
	}

	// If still not an array, fall back to single-item with raw response
	if (!Array.isArray(parsed)) {
		logger.warn("Gemini response was not valid JSON array; returning raw text");
		return [
			{
				id: 1,
				category: "General",
				question: "Gemini response",
				answer: responseText,
				source: "gemini",
			},
		];
	}

	// Normalize and cap to 12 items
	return (parsed as GeneratedQAItem[])
		.slice(0, 12)
		.map((item, idx) => ({
			id: item?.id ?? idx + 1,
			category: item?.category ?? "General",
			question: item?.question ?? "",
			answer: item?.answer ?? "",
			source: item?.source ?? "gemini",
		}));
};

export const markPrepProcessing = async (
	userId: string,
	jobDescription?: string,
	resumeUrl?: string,
): Promise<void> => {
	await InterviewPreparationModel.findOneAndUpdate(
		{ userId: new mongoose.Types.ObjectId(userId) },
		{
			status: "PROCESSING",
			error: null,
			jobDescription: jobDescription ?? undefined,
			resumeUrl: resumeUrl ?? undefined,
		},
		{ upsert: true, new: true },
	);
};

export const savePrepResult = async (
	userId: string,
	items: GeneratedQAItem[],
): Promise<InterviewPreparationDoc> => {
	return (await InterviewPreparationModel.findOneAndUpdate(
		{ userId: new mongoose.Types.ObjectId(userId) },
		{ status: "COMPLETED", items, error: null },
		{ upsert: true, new: true },
	).exec()) as unknown as InterviewPreparationDoc;
};

export const markPrepFailed = async (
	userId: string,
	error: string,
): Promise<InterviewPreparationDoc | null> => {
	return (await InterviewPreparationModel.findOneAndUpdate(
		{ userId: new mongoose.Types.ObjectId(userId) },
		{ status: "FAILED", error },
		{ upsert: true, new: true },
	).exec()) as unknown as InterviewPreparationDoc | null;
};

export const getLatestPrep = async (
	userId: string,
): Promise<InterviewPreparationDoc | null> => {
	return (await InterviewPreparationModel.findOne({
		userId: new mongoose.Types.ObjectId(userId),
	})
		.sort({ updatedAt: -1 })
		.exec()) as InterviewPreparationDoc | null;
};

