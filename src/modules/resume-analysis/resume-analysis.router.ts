import { canAccess } from "../../middlewares/can-access.middleware";
import MagicRouter from "../../openapi/magic-router";
import {
	handleAnalyzeResume,
	handleGetMyAnalyses,
	handleGetAnalysisById,
} from "./resume-analysis.controller";
import { analyzeResumeSchema } from "./resume-analysis.schema";

export const RESUME_ANALYSIS_ROUTER_ROOT = "/resume-analysis";

const resumeAnalysisRouter = new MagicRouter(RESUME_ANALYSIS_ROUTER_ROOT);

// Analyze resume against a job description
resumeAnalysisRouter.post(
	"/",
	{ requestType: { body: analyzeResumeSchema } },
	canAccess(),
	handleAnalyzeResume,
);

// Get all analyses for the current user
resumeAnalysisRouter.get("/", {}, canAccess(), handleGetMyAnalyses);

// Get a single analysis by ID
resumeAnalysisRouter.get("/:id", {}, canAccess(), handleGetAnalysisById);

export default resumeAnalysisRouter.getRouter();
