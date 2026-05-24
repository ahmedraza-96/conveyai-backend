import axios from "axios";
import config from "../config/config.service";
import logger from "./logger.service";

const TAVUS_BASE_URL = "https://tavusapi.com";

export type TavusConversationStatus = "active" | "ended" | "expired";

export interface TavusTranscriptEntry {
	role: "assistant" | "user";
	content: string;
	timestamp?: number;
}

export interface CreateTavusConversationParams {
	personaId: string;
	conversationName: string;
	conversationalContext: string;
	customGreeting?: string;
	maxCallDurationSeconds: number;
	callbackUrl?: string;
}

export interface TavusConversationCreateResult {
	conversation_id: string;
	conversation_url: string;
	status: string;
}

const tavusClient = () => {
	if (!config.TAVUS_API_KEY) {
		throw new Error("TAVUS_API_KEY is not configured");
	}
	return axios.create({
		baseURL: TAVUS_BASE_URL,
		headers: {
			"x-api-key": config.TAVUS_API_KEY,
			"Content-Type": "application/json",
		},
		timeout: 20_000,
	});
};

export const createTavusConversation = async (
	params: CreateTavusConversationParams,
): Promise<TavusConversationCreateResult> => {
	const client = tavusClient();
	const body = {
		persona_id: params.personaId,
		conversation_name: params.conversationName,
		conversational_context: params.conversationalContext,
		custom_greeting: params.customGreeting,
		properties: {
			max_call_duration: params.maxCallDurationSeconds,
			enable_recording: false,
			enable_closed_captions: true,
			apply_greenscreen: false,
		},
		callback_url: params.callbackUrl,
	};
	try {
		const response = await client.post("/v2/conversations", body);
		logger.info(
			{
				conversationId: response.data?.conversation_id,
				personaId: params.personaId,
			},
			"Tavus conversation created",
		);
		return response.data;
	} catch (error) {
		const msg = axios.isAxiosError(error)
			? typeof error.response?.data === "string"
				? error.response.data
				: JSON.stringify(error.response?.data || {})
			: (error as Error).message;
		logger.error({ error: msg }, "Failed to create Tavus conversation");
		throw new Error(`Tavus API Error: ${msg}`);
	}
};

export const endTavusConversation = async (
	conversationId: string,
): Promise<void> => {
	try {
		const client = tavusClient();
		await client.post(`/v2/conversations/${conversationId}/end`);
		logger.info({ conversationId }, "Tavus conversation ended");
	} catch (error) {
		// Don't throw — ending may race with Tavus' own shutdown.
		const msg = axios.isAxiosError(error)
			? error.response?.data || error.message
			: (error as Error).message;
		logger.warn({ conversationId, error: msg }, "Failed to end Tavus conversation");
	}
};

export const getTavusConversation = async (
	conversationId: string,
): Promise<{
	conversation_id: string;
	status: string;
	transcript?: Array<{ role: string; content: string; created_at?: string }>;
	[key: string]: unknown;
}> => {
	const client = tavusClient();
	try {
		const response = await client.get(`/v2/conversations/${conversationId}`);
		return response.data;
	} catch (error) {
		const msg = axios.isAxiosError(error)
			? error.response?.data || error.message
			: (error as Error).message;
		logger.error(
			{ conversationId, error: msg },
			"Failed to fetch Tavus conversation",
		);
		throw new Error(`Tavus API Error: ${msg}`);
	}
};

export const parseTavusTranscript = (
	raw: unknown,
): TavusTranscriptEntry[] => {
	if (!Array.isArray(raw)) return [];
	const out: TavusTranscriptEntry[] = [];
	for (const entry of raw) {
		if (!entry || typeof entry !== "object") continue;
		const e = entry as Record<string, unknown>;
		const role = e.role === "user" ? "user" : "assistant";
		const content = typeof e.content === "string" ? e.content : "";
		if (!content) continue;
		const createdAt = typeof e.created_at === "string" ? e.created_at : undefined;
		const timestamp = createdAt ? new Date(createdAt).getTime() / 1000 : undefined;
		out.push({ role, content, timestamp });
	}
	return out;
};

export const getTavusPersonaId = (): string | undefined => {
	return config.TAVUS_PERSONA_MALE_ID;
};
