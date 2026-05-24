import User from "../user/user.model";
import VoiceInterviewModel from "../voice-interview/voice-interview.model";

export const getStats = async () => {
	const now = new Date();
	const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);

	const [
		totalUsers,
		totalInterviews,
		statusAgg,
		analysisStatusAgg,
		scoreAgg,
		interviewsToday,
		interviewsThisWeek,
	] = await Promise.all([
		User.countDocuments(),
		VoiceInterviewModel.countDocuments(),
		VoiceInterviewModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
		VoiceInterviewModel.aggregate([
			{ $group: { _id: { $ifNull: ["$analysisStatus", "none"] }, count: { $sum: 1 } } },
		]),
		VoiceInterviewModel.aggregate([
			{ $match: { "analysis.overallScore": { $exists: true, $ne: null } } },
			{ $group: { _id: null, avg: { $avg: "$analysis.overallScore" } } },
		]),
		VoiceInterviewModel.countDocuments({ createdAt: { $gte: startOfToday } }),
		VoiceInterviewModel.countDocuments({ createdAt: { $gte: startOfWeek } }),
	]);

	// Build status maps from aggregation results
	const statusMap: Record<string, number> = {};
	for (const item of statusAgg) statusMap[item._id as string] = item.count as number;

	const analysisStatusMap: Record<string, number> = {};
	for (const item of analysisStatusAgg) analysisStatusMap[item._id as string] = item.count as number;

	const averageOverallScore = scoreAgg.length > 0 ? (scoreAgg[0].avg as number) : null;

	return {
		totalUsers,
		totalInterviews,
		interviewsByStatus: {
			created: statusMap["created"] ?? 0,
			in_progress: statusMap["in_progress"] ?? 0,
			completed: statusMap["completed"] ?? 0,
			failed: statusMap["failed"] ?? 0,
			cancelled: statusMap["cancelled"] ?? 0,
		},
		interviewsByAnalysisStatus: {
			pending: analysisStatusMap["pending"] ?? 0,
			completed: analysisStatusMap["completed"] ?? 0,
			failed: analysisStatusMap["failed"] ?? 0,
			none: analysisStatusMap["none"] ?? 0,
		},
		averageOverallScore,
		interviewsToday,
		interviewsThisWeek,
	};
};

export const getUsers = async (page: number, limit: number) => {
	const [result] = await User.aggregate([
		{
			$facet: {
				data: [
					{ $lookup: { from: "voiceinterviews", localField: "_id", foreignField: "userId", as: "interviews" } },
					{ $addFields: { interviewCount: { $size: "$interviews" } } },
					{ $project: { _id: 1, name: 1, username: 1, email: 1, role: 1, createdAt: 1, interviewCount: 1 } },
					{ $sort: { createdAt: -1 } },
					{ $skip: (page - 1) * limit },
					{ $limit: limit },
				],
				totalCount: [{ $count: "count" }],
			},
		},
	]);
	const users = result.data as Array<{ _id: unknown; name: string; username: string; email: string; role: string; createdAt: Date; interviewCount: number }>;
	const total = (result.totalCount[0] as { count: number } | undefined)?.count ?? 0;
	return { users, total, page, limit };
};

export const getVoiceInterviews = async (page: number, limit: number) => {
	const [raw, total] = await Promise.all([
		VoiceInterviewModel.find({})
			.select("userId mode interviewType status analysisStatus analysis.overallScore duration createdAt")
			.populate("userId", "name email")
			.sort({ createdAt: -1 })
			.skip((page - 1) * limit)
			.limit(limit)
			.lean(),
		VoiceInterviewModel.countDocuments(),
	]);

	const interviews = raw.map((item) => {
		const userId = item.userId as unknown as { _id: unknown; name?: string; email: string };
		return {
			_id: String(item._id),
			userId: {
				_id: String(userId._id),
				name: userId.name ?? null,
				email: userId.email,
			},
			mode: item.mode,
			interviewType: item.interviewType,
			status: item.status,
			analysisStatus: item.analysisStatus ?? "none",
			overallScore: (item.analysis as { overallScore?: number } | undefined)?.overallScore ?? null,
			duration: item.duration,
			createdAt: String(item.createdAt),
		};
	});

	return { interviews, total, page, limit };
};
