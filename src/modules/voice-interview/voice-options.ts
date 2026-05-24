import type { LanguageType } from "./voice-interview.constants";

export type VoiceProvider = "11labs" | "azure";

export interface VoiceOption {
	id: string;
	label: string;
	provider: VoiceProvider;
	voiceId: string;
	gender: "male" | "female";
	accent: string;
	style: string;
	supportedLanguages: LanguageType[];
}

export const VOICE_OPTIONS: readonly VoiceOption[] = [
	{
		id: "rachel",
		label: "Rachel",
		provider: "11labs",
		voiceId: "21m00Tcm4TlvDq8ikWAM",
		gender: "female",
		accent: "American",
		style: "Calm, professional",
		supportedLanguages: ["english"],
	},
	{
		id: "sarah",
		label: "Sarah",
		provider: "11labs",
		voiceId: "EXAVITQu4vr4xnSDxMaL",
		gender: "female",
		accent: "American",
		style: "Warm, soft",
		supportedLanguages: ["english"],
	},
	{
		id: "adam",
		label: "Adam",
		provider: "11labs",
		voiceId: "pNInz6obpgDQGcFmaJgB",
		gender: "male",
		accent: "American",
		style: "Deep, authoritative",
		supportedLanguages: ["english"],
	},
	{
		id: "drew",
		label: "Drew",
		provider: "11labs",
		voiceId: "29vD33N1CtxCmqQRPOHJ",
		gender: "male",
		accent: "American",
		style: "Conversational",
		supportedLanguages: ["english"],
	},
	{
		id: "uzma",
		label: "Uzma",
		provider: "azure",
		voiceId: "ur-PK-UzmaNeural",
		gender: "female",
		accent: "Pakistani Urdu",
		style: "Natural, friendly",
		supportedLanguages: ["english", "urdu", "roman_urdu"],
	},
	{
		id: "asad",
		label: "Asad",
		provider: "azure",
		voiceId: "ur-PK-AsadNeural",
		gender: "male",
		accent: "Pakistani Urdu",
		style: "Steady, professional",
		supportedLanguages: ["english", "urdu", "roman_urdu"],
	},
] as const;

export const VOICE_OPTION_IDS = VOICE_OPTIONS.map((v) => v.id);

export type VoiceOptionId = (typeof VOICE_OPTIONS)[number]["id"];

export const getVoiceOption = (id?: string | null): VoiceOption | undefined =>
	id ? VOICE_OPTIONS.find((v) => v.id === id) : undefined;

const URDU_FEMALE = VOICE_OPTIONS.find((v) => v.id === "uzma")!;
const URDU_MALE = VOICE_OPTIONS.find((v) => v.id === "asad")!;

/**
 * Resolves the voice to send to Vapi for a session. Returns undefined when
 * the user has no preference and the caller should fall back to the personality
 * preset's default voice. When the session is in Urdu/Roman Urdu and the chosen
 * voice doesn't speak Urdu, auto-swaps to the matching-gender Pakistani Urdu
 * voice (Uzma for female, Asad for male).
 */
export const resolveVoiceForSession = (
	preferredVoiceId: string | null | undefined,
	language: LanguageType,
): { provider: VoiceProvider; voiceId: string } | undefined => {
	const isUrdu = language !== "english";
	const chosen = getVoiceOption(preferredVoiceId);

	if (isUrdu) {
		if (chosen && chosen.supportedLanguages.includes(language)) {
			return { provider: chosen.provider, voiceId: chosen.voiceId };
		}
		const swap = chosen?.gender === "male" ? URDU_MALE : URDU_FEMALE;
		return { provider: swap.provider, voiceId: swap.voiceId };
	}

	if (!chosen) return undefined;
	return { provider: chosen.provider, voiceId: chosen.voiceId };
};
