import mongoose from "mongoose";
import VoiceInterviewModel from "./voice-interview.model";
import { VOICE_INTERVIEW_STATUS } from "./voice-interview.constants";
import logger from "../../lib/logger.service";

export interface AdaptiveContext {
	weakAreas: string[];
	strongAreas: string[];
	commonWeaknesses: string[];
	overallTrend: "improving" | "declining" | "stable";
	totalCompletedInterviews: number;
}

export const computeAdaptiveContext = async (
	userId: string,
): Promise<AdaptiveContext | null> => {
	const sessions = await VoiceInterviewModel.find({
		userId: new mongoose.Types.ObjectId(userId),
		status: VOICE_INTERVIEW_STATUS.COMPLETED,
		analysis: { $exists: true, $ne: null },
	})
		.sort({ createdAt: -1 })
		.limit(20)
		.lean()
		.exec();

	if (sessions.length < 2) {
		return null;
	}

	try {
		// Aggregate skill scores across sessions
		const skillAggregates: Record<string, number[]> = {};
		const allWeaknesses: string[] = [];

		for (const session of sessions) {
			if (!session.analysis) continue;

			if (Array.isArray(session.analysis.skillScores)) {
				for (const skill of session.analysis.skillScores) {
					const key = skill.skill.toLowerCase().trim();
					if (!skillAggregates[key]) {
						skillAggregates[key] = [];
					}
					skillAggregates[key].push(skill.score);
				}
			}

			if (Array.isArray(session.analysis.weaknesses)) {
				allWeaknesses.push(...session.analysis.weaknesses);
			}
		}

		// Find weak areas (avg < 65) and strong areas (avg >= 80)
		const weakAreas: string[] = [];
		const strongAreas: string[] = [];

		for (const [skill, scores] of Object.entries(skillAggregates)) {
			const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
			if (avg < 65) {
				weakAreas.push(skill);
			} else if (avg >= 80) {
				strongAreas.push(skill);
			}
		}

		// Count recurring weaknesses (appearing in 2+ sessions)
		const weaknessCounts: Record<string, number> = {};
		for (const w of allWeaknesses) {
			const normalized = w.toLowerCase().trim();
			weaknessCounts[normalized] = (weaknessCounts[normalized] || 0) + 1;
		}

		const commonWeaknesses = Object.entries(weaknessCounts)
			.filter(([, count]) => count >= 2)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([weakness]) => weakness);

		// Determine overall trend from recent scores
		const recentScores = sessions
			.filter((s) => s.analysis?.overallScore != null)
			.slice(0, 5)
			.map((s) => s.analysis!.overallScore);

		let overallTrend: "improving" | "declining" | "stable" = "stable";
		if (recentScores.length >= 3) {
			// Scores are newest-first; reverse for chronological
			const chronological = [...recentScores].reverse();
			const firstHalf = chronological.slice(
				0,
				Math.floor(chronological.length / 2),
			);
			const secondHalf = chronological.slice(
				Math.floor(chronological.length / 2),
			);
			const avgFirst =
				firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
			const avgSecond =
				secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

			if (avgSecond - avgFirst > 5) {
				overallTrend = "improving";
			} else if (avgFirst - avgSecond > 5) {
				overallTrend = "declining";
			}
		}

		logger.info(
			{
				userId,
				weakAreas,
				strongAreas,
				commonWeaknesses,
				overallTrend,
				totalSessions: sessions.length,
			},
			"Computed adaptive context",
		);

		return {
			weakAreas,
			strongAreas,
			commonWeaknesses,
			overallTrend,
			totalCompletedInterviews: sessions.length,
		};
	} catch (error) {
		logger.error({ userId, error }, "Failed to compute adaptive context");
		return null;
	}
};
