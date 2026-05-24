import { canAccess } from "../../middlewares/can-access.middleware";
import MagicRouter from "../../openapi/magic-router";
import {
	handleCreateInterview,
	handleDeleteInterview,
	handleGetInterview,
	handleGetMyInterviews,
	handleUpdateInterview,
} from "./interview.controller";
import {
	createInterviewSchema,
	interviewIdSchema,
	updateInterviewSchema,
} from "./interview.schema";

export const INTERVIEW_ROUTER_ROOT = "/interviews";

const interviewRouter = new MagicRouter(INTERVIEW_ROUTER_ROOT);

// Create a new interview
interviewRouter.post(
	"/",
	{ requestType: { body: createInterviewSchema } },
	canAccess(),
	handleCreateInterview
);

// Get all interviews for the current user
interviewRouter.get("/", {}, canAccess(), handleGetMyInterviews);

// Get a specific interview by ID
interviewRouter.get(
	"/:id",
	{ requestType: { params: interviewIdSchema } },
	canAccess(),
	handleGetInterview
);

// Update an interview
interviewRouter.put(
	"/:id",
	{
		requestType: {
			params: interviewIdSchema,
			body: updateInterviewSchema,
		},
	},
	canAccess(),
	handleUpdateInterview
);

// Delete an interview
interviewRouter.delete(
	"/:id",
	{ requestType: { params: interviewIdSchema } },
	canAccess(),
	handleDeleteInterview
);

export default interviewRouter.getRouter();
