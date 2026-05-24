import express from "express";
import authRouter, { AUTH_ROUTER_ROOT } from "../modules/auth/auth.router";

import healthCheckRouter, {
	HEALTH_ROUTER_ROOT,
} from "../healthcheck/healthcheck.routes";
import interviewRouter, { INTERVIEW_ROUTER_ROOT } from "../modules/interview/interview.router";
import interviewPreparationRouter, {
	INTERVIEW_PREPARATION_ROUTER_ROOT,
} from "../modules/interview-preparation/interview-preparation.router";
import userRouter, { USER_ROUTER_ROOT } from "../modules/user/user.router";
import uploadRouter, { UPLOAD_ROUTER_ROOT } from "../upload/upload.router";
import voiceInterviewRouter, {
	VOICE_INTERVIEW_ROUTER_ROOT,
} from "../modules/voice-interview/voice-interview.router";
import resumeAnalysisRouter, {
	RESUME_ANALYSIS_ROUTER_ROOT,
} from "../modules/resume-analysis/resume-analysis.router";
import chatRouter, {
	CHAT_ROUTER_ROOT,
} from "../modules/chat/chat.router";

import adminRouter, { ADMIN_ROUTER_ROOT } from "../modules/admin/admin.router";
const router = express.Router();

router.use(HEALTH_ROUTER_ROOT, healthCheckRouter);
router.use(USER_ROUTER_ROOT, userRouter);
router.use(AUTH_ROUTER_ROOT, authRouter);
router.use(INTERVIEW_ROUTER_ROOT, interviewRouter);
router.use(INTERVIEW_PREPARATION_ROUTER_ROOT, interviewPreparationRouter);
router.use(UPLOAD_ROUTER_ROOT, uploadRouter);
router.use(VOICE_INTERVIEW_ROUTER_ROOT, voiceInterviewRouter);
router.use(RESUME_ANALYSIS_ROUTER_ROOT, resumeAnalysisRouter);
router.use(CHAT_ROUTER_ROOT, chatRouter);
router.use(ADMIN_ROUTER_ROOT, adminRouter);

export default router;
