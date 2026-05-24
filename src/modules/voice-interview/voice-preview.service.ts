import axios from "axios";
import config from "../../config/config.service";
import logger from "../../lib/logger.service";
import { getVoiceOption, type VoiceOption } from "./voice-options";

const PREVIEW_TEXT_EN =
	"Hi! I'm your AI interviewer. Let's get started with your practice session.";
const PREVIEW_TEXT_UR =
	"السلام علیکم! میں آپ کا اے آئی انٹرویوئر ہوں۔ آئیے انٹرویو شروع کرتے ہیں۔";

// Some ElevenLabs library voices require a paid plan to use via the API
// (Rachel, Drew). For those, the Settings preview clip is rendered using a
// similar-character Azure neural voice. The actual interview still uses the
// real ElevenLabs voice via Vapi.
const AZURE_PREVIEW_FOR_ELEVEN: Record<string, string> = {
	rachel: "en-US-JennyNeural",
	drew: "en-US-AndrewNeural",
};

const cache = new Map<string, Buffer>();

const fetchAzureTts = async (
	azureVoice: string,
	lang: "en-US" | "ur-PK",
	text: string,
): Promise<Buffer> => {
	if (!config.AZURE_TTS_KEY || !config.AZURE_TTS_REGION) {
		throw new Error("AZURE_TTS_KEY / AZURE_TTS_REGION are not configured");
	}
	const ssml = `<speak version='1.0' xml:lang='${lang}'><voice name='${azureVoice}'>${text}</voice></speak>`;
	const response = await axios.post(
		`https://${config.AZURE_TTS_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
		ssml,
		{
			headers: {
				"Ocp-Apim-Subscription-Key": config.AZURE_TTS_KEY,
				"Content-Type": "application/ssml+xml",
				"X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
				"User-Agent": "conveyai-preview",
			},
			responseType: "arraybuffer",
			timeout: 20_000,
		},
	);
	return Buffer.from(response.data);
};

const fetchElevenLabs = async (voice: VoiceOption): Promise<Buffer> => {
	if (!config.ELEVENLABS_API_KEY) {
		throw new Error("ELEVENLABS_API_KEY is not configured");
	}
	const response = await axios.post(
		`https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}`,
		{
			text: PREVIEW_TEXT_EN,
			model_id: "eleven_multilingual_v2",
			voice_settings: { stability: 0.5, similarity_boost: 0.75 },
		},
		{
			headers: {
				"xi-api-key": config.ELEVENLABS_API_KEY,
				"Content-Type": "application/json",
				Accept: "audio/mpeg",
			},
			responseType: "arraybuffer",
			timeout: 20_000,
		},
	);
	return Buffer.from(response.data);
};

const previewForVoice = async (voice: VoiceOption): Promise<Buffer> => {
	if (voice.provider === "azure") {
		return fetchAzureTts(voice.voiceId, "ur-PK", PREVIEW_TEXT_UR);
	}
	const azureVoice = AZURE_PREVIEW_FOR_ELEVEN[voice.id];
	if (azureVoice) {
		return fetchAzureTts(azureVoice, "en-US", PREVIEW_TEXT_EN);
	}
	return fetchElevenLabs(voice);
};

export const generateVoicePreview = async (
	voiceId: string,
): Promise<Buffer> => {
	const cached = cache.get(voiceId);
	if (cached) return cached;

	const voice = getVoiceOption(voiceId);
	if (!voice) {
		throw new Error(`Unknown voice id: ${voiceId}`);
	}

	try {
		const audio = await previewForVoice(voice);
		cache.set(voiceId, audio);
		logger.info({ voiceId, bytes: audio.length }, "Voice preview generated");
		return audio;
	} catch (error) {
		let msg = (error as Error).message;
		let status: number | undefined;
		if (axios.isAxiosError(error)) {
			status = error.response?.status;
			const raw = error.response?.data;
			if (raw) {
				const decoded = Buffer.isBuffer(raw)
					? raw.toString("utf8")
					: raw instanceof ArrayBuffer
						? Buffer.from(raw).toString("utf8")
						: typeof raw === "string"
							? raw
							: JSON.stringify(raw);
				msg = decoded || msg;
			}
		}
		logger.error(
			{ voiceId, status, error: msg },
			"Failed to generate voice preview",
		);
		throw new Error(`${status ? `[${status}] ` : ""}${msg}`);
	}
};
