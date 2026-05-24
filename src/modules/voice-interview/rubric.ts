/**
 * Interview scoring rubric — fixed dimensions, weights, and 0-4 anchors.
 *
 * Bump RUBRIC_VERSION any time a dimension, weight, or anchor changes.
 * Historical `InterviewAnalysis` rows keep their original `rubricVersion`
 * so past scores remain auditable against the rubric they were scored under.
 */

export const RUBRIC_VERSION = "v1-2026-04";

export type RubricDimensionId =
	| "technical_accuracy"
	| "communication_clarity"
	| "structured_thinking"
	| "confidence_delivery"
	| "role_alignment";

export interface RubricAnchor {
	score: 0 | 1 | 2 | 3 | 4;
	label: string;
	description: string;
}

export interface RubricDimension {
	id: RubricDimensionId;
	label: string;
	weight: number; // 0..1, weights across all dimensions sum to 1
	description: string;
	anchors: RubricAnchor[];
}

const SHARED_ANCHOR_LABELS: Record<0 | 1 | 2 | 3 | 4, string> = {
	4: "Excellent",
	3: "Strong",
	2: "Adequate",
	1: "Weak",
	0: "Not demonstrated",
};

export const RUBRIC_DIMENSIONS: RubricDimension[] = [
	{
		id: "technical_accuracy",
		label: "Technical Accuracy",
		weight: 0.3,
		description:
			"Correctness of technical answers, depth of explanation, and awareness of trade-offs and edge cases relevant to the question topic or job description.",
		anchors: [
			{ score: 4, label: SHARED_ANCHOR_LABELS[4], description: "Consistently correct, deep explanations with trade-offs, edge cases, and alternatives discussed unprompted." },
			{ score: 3, label: SHARED_ANCHOR_LABELS[3], description: "Largely correct with minor inaccuracies; some trade-offs discussed." },
			{ score: 2, label: SHARED_ANCHOR_LABELS[2], description: "Core concept correct but shallow; notable gaps in depth or edge-case awareness." },
			{ score: 1, label: SHARED_ANCHOR_LABELS[1], description: "Partial or confused understanding; meaningful technical errors." },
			{ score: 0, label: SHARED_ANCHOR_LABELS[0], description: "Off-topic, incorrect, or no technical substance." },
		],
	},
	{
		id: "communication_clarity",
		label: "Communication Clarity",
		weight: 0.2,
		description:
			"Clarity of explanation, articulation, sentence structure, and appropriate use of domain vocabulary without jargon overload.",
		anchors: [
			{ score: 4, label: SHARED_ANCHOR_LABELS[4], description: "Crisp, concise, well-structured; terminology used precisely and accessibly." },
			{ score: 3, label: SHARED_ANCHOR_LABELS[3], description: "Clear with minor rambling or jargon; main ideas easy to follow." },
			{ score: 2, label: SHARED_ANCHOR_LABELS[2], description: "Understandable but disorganized; occasional jargon misuse or unclear phrasing." },
			{ score: 1, label: SHARED_ANCHOR_LABELS[1], description: "Frequently unclear, rambling, or incoherent." },
			{ score: 0, label: SHARED_ANCHOR_LABELS[0], description: "Responses unintelligible or missing." },
		],
	},
	{
		id: "structured_thinking",
		label: "Structured Thinking",
		weight: 0.2,
		description:
			"Logical decomposition of problems, use of frameworks like STAR for behavioral answers, and coherent step-by-step reasoning.",
		anchors: [
			{ score: 4, label: SHARED_ANCHOR_LABELS[4], description: "Clearly structured answers (STAR / problem decomposition); each step builds on the previous." },
			{ score: 3, label: SHARED_ANCHOR_LABELS[3], description: "Mostly structured with minor jumps; identifiable framework usage." },
			{ score: 2, label: SHARED_ANCHOR_LABELS[2], description: "Some structure but frequently skips steps or jumps to conclusions." },
			{ score: 1, label: SHARED_ANCHOR_LABELS[1], description: "Stream-of-consciousness answers; little logical flow." },
			{ score: 0, label: SHARED_ANCHOR_LABELS[0], description: "No discernible structure or reasoning." },
		],
	},
	{
		id: "confidence_delivery",
		label: "Confidence & Delivery",
		weight: 0.15,
		description:
			"Steadiness of delivery, measured by hesitations, filler-word frequency, response latency, and pacing. Draws on objective speech analytics when available.",
		anchors: [
			{ score: 4, label: SHARED_ANCHOR_LABELS[4], description: "Confident pace, minimal fillers (<3%), prompt responses; no long hesitations." },
			{ score: 3, label: SHARED_ANCHOR_LABELS[3], description: "Mostly steady with occasional fillers or brief hesitations." },
			{ score: 2, label: SHARED_ANCHOR_LABELS[2], description: "Noticeable fillers (>5%) or several pauses; delivery uneven." },
			{ score: 1, label: SHARED_ANCHOR_LABELS[1], description: "Heavy fillers, frequent long pauses, or halting delivery." },
			{ score: 0, label: SHARED_ANCHOR_LABELS[0], description: "Delivery unusable or no substantive speech." },
		],
	},
	{
		id: "role_alignment",
		label: "Role Alignment",
		weight: 0.15,
		description:
			"How well the candidate's answers map to the requested topic, job description, or difficulty level of the interview.",
		anchors: [
			{ score: 4, label: SHARED_ANCHOR_LABELS[4], description: "Answers tightly aligned to the role/topic; examples chosen for relevance to the JD." },
			{ score: 3, label: SHARED_ANCHOR_LABELS[3], description: "Generally aligned with the role; minor tangents." },
			{ score: 2, label: SHARED_ANCHOR_LABELS[2], description: "Partially aligned; some answers generic or off-topic." },
			{ score: 1, label: SHARED_ANCHOR_LABELS[1], description: "Weak connection to the role or topic requested." },
			{ score: 0, label: SHARED_ANCHOR_LABELS[0], description: "Answers unrelated to the interview scope." },
		],
	},
];

export interface RubricDimensionScoreInput {
	dimension: RubricDimensionId;
	score: number;
}

/**
 * Weighted rubric → 0-100 overall score.
 *   overall = round( Σ (score_i * weight_i) * 25 )
 * where each score is 0-4 and weights sum to 1 → range [0,100].
 */
export const computeOverallFromRubric = (
	scores: RubricDimensionScoreInput[],
): number => {
	const byId = new Map(scores.map((s) => [s.dimension, s.score]));
	let weighted = 0;
	for (const dim of RUBRIC_DIMENSIONS) {
		const raw = byId.get(dim.id) ?? 0;
		const clamped = Math.max(0, Math.min(4, raw));
		weighted += clamped * dim.weight;
	}
	return Math.round(weighted * 25);
};

export const getAnchorLabel = (score: number): string => {
	const clamped = Math.max(0, Math.min(4, Math.round(score))) as 0 | 1 | 2 | 3 | 4;
	return SHARED_ANCHOR_LABELS[clamped];
};

/**
 * Renders the rubric into a prompt block for the LLM. The block declares
 * all dimensions, weights, and 0-4 anchors so the model scores every
 * dimension against the same fixed criteria on every interview.
 */
export const buildRubricPromptSection = (): string => {
	const lines: string[] = [];
	lines.push("RUBRIC (apply every dimension, in order):");
	for (const dim of RUBRIC_DIMENSIONS) {
		lines.push("");
		lines.push(
			`- ${dim.label} [id: ${dim.id}, weight: ${Math.round(dim.weight * 100)}%]`,
		);
		lines.push(`  Definition: ${dim.description}`);
		lines.push("  Anchors:");
		for (const a of dim.anchors) {
			lines.push(`    ${a.score} (${a.label}): ${a.description}`);
		}
	}
	return lines.join("\n");
};

/** Returns dimension ids in the canonical order used in every prompt/response. */
export const RUBRIC_DIMENSION_IDS: RubricDimensionId[] = RUBRIC_DIMENSIONS.map(
	(d) => d.id,
);

export const getDimensionWeight = (id: RubricDimensionId): number => {
	const d = RUBRIC_DIMENSIONS.find((x) => x.id === id);
	return d ? d.weight : 0;
};

export const getDimensionLabel = (id: RubricDimensionId): string => {
	const d = RUBRIC_DIMENSIONS.find((x) => x.id === id);
	return d ? d.label : id;
};
