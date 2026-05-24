import axios from "axios";
import config from "../config/config.service";
import logger from "./logger.service";

const VAPI_BASE_URL = "https://api.vapi.ai";

const vapiClient = axios.create({
	baseURL: VAPI_BASE_URL,
	headers: {
		Authorization: `Bearer ${config.VAPI_API_KEY}`,
		"Content-Type": "application/json",
	},
});

export type VapiAssistantConfig = {
	name: string;
	model: {
		provider: "google";
		model: string;
		messages: Array<{ role: "system"; content: string }>;
		temperature?: number;
	};
	voice: {
		provider: "11labs" | "playht" | "deepgram" | "azure";
		voiceId: string;
	};
	transcriber?: {
		provider: "deepgram";
		model: string;
		language: string;
	};
	firstMessage: string;
	endCallMessage?: string;
	maxDurationSeconds?: number;
	silenceTimeoutSeconds?: number;
	serverUrl?: string;
};

export const createVapiAssistant = async (
	assistantConfig: VapiAssistantConfig,
): Promise<{ id: string; [key: string]: unknown }> => {
	try {
		const response = await vapiClient.post("/assistant", assistantConfig);
		logger.info(
			{ assistantId: response.data.id },
			"Vapi assistant created",
		);
		return response.data;
	} catch (error) {
		if (axios.isAxiosError(error)) {
			const msg =
				error.response?.data?.message || error.message || "Vapi API error";
			logger.error({ error: msg }, "Failed to create Vapi assistant");
			throw new Error(`Vapi API Error: ${msg}`);
		}
		throw error;
	}
};

export const getVapiCall = async (
	callId: string,
): Promise<{
	id: string;
	status: string;
	transcript?: string;
	recordingUrl?: string;
	duration?: number;
	messages?: Array<{ role: string; message: string; time: number }>;
	[key: string]: unknown;
}> => {
	try {
		const response = await vapiClient.get(`/call/${callId}`);
		return response.data;
	} catch (error) {
		if (axios.isAxiosError(error)) {
			const msg =
				error.response?.data?.message || error.message || "Vapi API error";
			logger.error({ callId, error: msg }, "Failed to get Vapi call");
			throw new Error(`Vapi API Error: ${msg}`);
		}
		throw error;
	}
};

export const listVapiCallsByAssistant = async (
	assistantId: string,
): Promise<Array<{
	id: string;
	status: string;
	transcript?: string;
	recordingUrl?: string;
	duration?: number;
	messages?: Array<{ role: string; message: string; time: number }>;
	[key: string]: unknown;
}>> => {
	try {
		const response = await vapiClient.get("/call", {
			params: { assistantId, limit: 1 },
		});
		return Array.isArray(response.data) ? response.data : [];
	} catch (error) {
		if (axios.isAxiosError(error)) {
			const msg =
				error.response?.data?.message || error.message || "Vapi API error";
			logger.error({ assistantId, error: msg }, "Failed to list Vapi calls by assistant");
			throw new Error(`Vapi API Error: ${msg}`);
		}
		throw error;
	}
};

export const deleteVapiAssistant = async (
	assistantId: string,
): Promise<void> => {
	try {
		await vapiClient.delete(`/assistant/${assistantId}`);
		logger.info({ assistantId }, "Vapi assistant deleted");
	} catch (error) {
		if (axios.isAxiosError(error)) {
			const msg =
				error.response?.data?.message || error.message || "Vapi API error";
			logger.error(
				{ assistantId, error: msg },
				"Failed to delete Vapi assistant",
			);
		}
	}
};
