export const INTERVIEW_STATUS = {
	CREATED: 'created',
	IN_PROGRESS: 'in_progress',
	COMPLETED: 'completed',
	CANCELLED: 'cancelled',
} as const;

export const INTERVIEW_TYPES = {
	TECHNICAL: 'technical',
	BEHAVIORAL: 'behavioral',
	MIXED: 'mixed',
} as const;

export type InterviewStatus = typeof INTERVIEW_STATUS[keyof typeof INTERVIEW_STATUS];
export type InterviewType = typeof INTERVIEW_TYPES[keyof typeof INTERVIEW_TYPES];
