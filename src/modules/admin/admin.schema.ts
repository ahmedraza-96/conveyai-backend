import z from "zod";

export const AdminListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminListQueryType = z.infer<typeof AdminListQuerySchema>;

export const AdminStatsSchema = z.object({
	totalUsers: z.number(),
	totalInterviews: z.number(),
	interviewsByStatus: z.object({
		created: z.number(),
		in_progress: z.number(),
		completed: z.number(),
		failed: z.number(),
		cancelled: z.number(),
	}),
	interviewsByAnalysisStatus: z.object({
		pending: z.number(),
		completed: z.number(),
		failed: z.number(),
		none: z.number(),
	}),
	averageOverallScore: z.number().nullable(),
	interviewsToday: z.number(),
	interviewsThisWeek: z.number(),
});

export const AdminUserItemSchema = z.object({
	_id: z.string(),
	name: z.string().nullable().optional(),
	username: z.string(),
	email: z.string(),
	role: z.string(),
	createdAt: z.string(),
	interviewCount: z.number(),
});

export const AdminUsersResponseSchema = z.object({
	users: z.array(AdminUserItemSchema),
	total: z.number(),
	page: z.number(),
	limit: z.number(),
});

export const AdminInterviewItemSchema = z.object({
	_id: z.string(),
	userId: z.object({
		_id: z.string(),
		name: z.string().nullable().optional(),
		email: z.string(),
	}),
	mode: z.string(),
	interviewType: z.string(),
	status: z.string(),
	analysisStatus: z.string(),
	overallScore: z.number().nullable().optional(),
	duration: z.number(),
	createdAt: z.string(),
});

export const AdminInterviewsResponseSchema = z.object({
	interviews: z.array(AdminInterviewItemSchema),
	total: z.number(),
	page: z.number(),
	limit: z.number(),
});
