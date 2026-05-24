import { canAccess } from "../../middlewares/can-access.middleware";
import MagicRouter from "../../openapi/magic-router";
import {
	handleGetLatestInterviewPrep,
	handleTestGemini,
} from "./interview-preparation.controller";
import { testGeminiSchema } from "./interview-preparation.schema";

export const INTERVIEW_PREPARATION_ROUTER_ROOT = "/interview-preparation";

const interviewPreparationRouter = new MagicRouter(INTERVIEW_PREPARATION_ROUTER_ROOT);

// Test Gemini API endpoint
interviewPreparationRouter.post(
	"/test-gemini",
	{ requestType: { body: testGeminiSchema } },
	canAccess(),
	handleTestGemini,
);

// Get latest generated interview prep for the current user
interviewPreparationRouter.get(
	"/latest",
	{},
	canAccess(),
	handleGetLatestInterviewPrep,
);

export default interviewPreparationRouter.getRouter();

