import axios from "axios";
import config from "../config/config.service";
import logger from "./logger.service";

// Shared LLM client. Tries OpenAI first, falls back to Gemini on failure.
// This isolates model-provider concerns from feature modules so individual
// callers don't have to deal with provider switching themselves.

const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const OPENAI_MODEL = "gpt-4o-mini";
const GEMINI_MODEL = "gemini-2.5-flash";

export type ChatMessage = { role: string; content: string };

const extractAxiosError = (error: unknown, providerLabel: string): Error => {
	if (axios.isAxiosError(error)) {
		const errorMessage =
			error.response?.data?.error?.message ||
			error.message ||
			`Failed to communicate with ${providerLabel}`;
		return new Error(`${providerLabel} Error: ${errorMessage}`);
	}
	const err = error as Error;
	return new Error(`Unexpected ${providerLabel} error: ${err.message}`);
};

// ─── OpenAI ──────────────────────────────────────────────────────

const callOpenAIModel = async (prompt: string): Promise<string> => {
	try {
		const response = await axios.post(
			`${OPENAI_API_BASE_URL}/chat/completions`,
			{
				model: OPENAI_MODEL,
				messages: [{ role: "user", content: prompt }],
			},
			{
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config.OPENAI_API_KEY}`,
				},
			},
		);

		return (
			response.data?.choices?.[0]?.message?.content ||
			"No response generated"
		);
	} catch (error: unknown) {
		throw extractAxiosError(error, "OpenAI API");
	}
};

const callOpenAIChat = async (
	systemPrompt: string,
	messages: ChatMessage[],
): Promise<string> => {
	try {
		const oaiMessages: ChatMessage[] = [
			{ role: "system", content: systemPrompt },
			...messages.map((m) => ({
				role: m.role === "model" ? "assistant" : m.role,
				content: m.content,
			})),
		];

		const response = await axios.post(
			`${OPENAI_API_BASE_URL}/chat/completions`,
			{
				model: OPENAI_MODEL,
				messages: oaiMessages,
			},
			{
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config.OPENAI_API_KEY}`,
				},
			},
		);

		return (
			response.data?.choices?.[0]?.message?.content ||
			"I'm sorry, I couldn't generate a response. Please try again."
		);
	} catch (error: unknown) {
		throw extractAxiosError(error, "OpenAI API");
	}
};

const streamOpenAIChat = async (
	systemPrompt: string,
	messages: ChatMessage[],
	onChunk: (text: string) => void,
): Promise<string> => {
	const oaiMessages: ChatMessage[] = [
		{ role: "system", content: systemPrompt },
		...messages.map((m) => ({
			role: m.role === "model" ? "assistant" : m.role,
			content: m.content,
		})),
	];

	const response = await axios.post(
		`${OPENAI_API_BASE_URL}/chat/completions`,
		{
			model: OPENAI_MODEL,
			messages: oaiMessages,
			stream: true,
		},
		{
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${config.OPENAI_API_KEY}`,
			},
			responseType: "stream",
		},
	);

	let fullText = "";
	let buffer = "";

	return new Promise((resolve, reject) => {
		response.data.on("data", (chunk: Buffer) => {
			buffer += chunk.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed.startsWith("data:")) continue;
				const jsonStr = trimmed.slice(5).trim();
				if (!jsonStr || jsonStr === "[DONE]") continue;

				try {
					const parsed = JSON.parse(jsonStr);
					const text = parsed?.choices?.[0]?.delta?.content;
					if (text) {
						fullText += text;
						onChunk(text);
					}
				} catch {
					// ignore incomplete JSON chunks
				}
			}
		});

		response.data.on("end", () => {
			resolve(fullText || "No response generated");
		});

		response.data.on("error", (err: Error) => {
			reject(new Error(`Stream error: ${err.message}`));
		});
	});
};

// ─── Gemini (fallback) ───────────────────────────────────────────

const callGeminiModel = async (prompt: string): Promise<string> => {
	try {
		const url = `${GEMINI_API_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${config.GOOGLE_GEMINI_API_KEY}`;
		const response = await axios.post(
			url,
			{ contents: [{ parts: [{ text: prompt }] }] },
			{ headers: { "Content-Type": "application/json" } },
		);
		return (
			response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
			"No response generated"
		);
	} catch (error: unknown) {
		throw extractAxiosError(error, "Gemini API");
	}
};

const callGeminiChat = async (
	systemPrompt: string,
	messages: ChatMessage[],
): Promise<string> => {
	try {
		const url = `${GEMINI_API_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${config.GOOGLE_GEMINI_API_KEY}`;
		const contents = messages.map((m) => ({
			role: m.role === "assistant" ? "model" : "user",
			parts: [{ text: m.content }],
		}));

		const response = await axios.post(
			url,
			{
				systemInstruction: { parts: [{ text: systemPrompt }] },
				contents,
			},
			{ headers: { "Content-Type": "application/json" } },
		);

		return (
			response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
			"I'm sorry, I couldn't generate a response. Please try again."
		);
	} catch (error: unknown) {
		throw extractAxiosError(error, "Gemini API");
	}
};

const streamGeminiChat = async (
	systemPrompt: string,
	messages: ChatMessage[],
	onChunk: (text: string) => void,
): Promise<string> => {
	const url = `${GEMINI_API_BASE_URL}/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${config.GOOGLE_GEMINI_API_KEY}`;
	const contents = messages.map((m) => ({
		role: m.role === "assistant" ? "model" : "user",
		parts: [{ text: m.content }],
	}));

	const response = await axios.post(
		url,
		{
			systemInstruction: { parts: [{ text: systemPrompt }] },
			contents,
		},
		{
			headers: { "Content-Type": "application/json" },
			responseType: "stream",
		},
	);

	let fullText = "";
	let buffer = "";

	return new Promise((resolve, reject) => {
		response.data.on("data", (chunk: Buffer) => {
			buffer += chunk.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				if (line.startsWith("data: ")) {
					const jsonStr = line.slice(6).trim();
					if (!jsonStr || jsonStr === "[DONE]") continue;
					try {
						const parsed = JSON.parse(jsonStr);
						const text =
							parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
						if (text) {
							fullText += text;
							onChunk(text);
						}
					} catch {
						// ignore incomplete JSON chunks
					}
				}
			}
		});

		response.data.on("end", () => {
			resolve(fullText || "No response generated");
		});

		response.data.on("error", (err: Error) => {
			reject(new Error(`Stream error: ${err.message}`));
		});
	});
};

// ─── Public API: OpenAI first, Gemini fallback ──────────────────

const hasGeminiKey = (): boolean => Boolean(config.GOOGLE_GEMINI_API_KEY);

export const callLLM = async (prompt: string): Promise<string> => {
	try {
		return await callOpenAIModel(prompt);
	} catch (err) {
		if (!hasGeminiKey()) throw err;
		logger.warn(
			{ err: (err as Error).message },
			"OpenAI call failed, falling back to Gemini",
		);
		return callGeminiModel(prompt);
	}
};

export const callLLMChat = async (
	systemPrompt: string,
	messages: ChatMessage[],
): Promise<string> => {
	try {
		return await callOpenAIChat(systemPrompt, messages);
	} catch (err) {
		if (!hasGeminiKey()) throw err;
		logger.warn(
			{ err: (err as Error).message },
			"OpenAI chat failed, falling back to Gemini",
		);
		return callGeminiChat(systemPrompt, messages);
	}
};

export const streamLLMChat = async (
	systemPrompt: string,
	messages: ChatMessage[],
	onChunk: (text: string) => void,
): Promise<string> => {
	try {
		return await streamOpenAIChat(systemPrompt, messages, onChunk);
	} catch (err) {
		if (!hasGeminiKey()) throw err;
		logger.warn(
			{ err: (err as Error).message },
			"OpenAI stream failed, falling back to Gemini",
		);
		return streamGeminiChat(systemPrompt, messages, onChunk);
	}
};
