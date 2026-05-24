import { canAccess } from "../../middlewares/can-access.middleware";
import MagicRouter from "../../openapi/magic-router";
import {
	handleGetStats,
	handleGetUsers,
	handleGetVoiceInterviews,
} from "./admin.controller";
import { AdminListQuerySchema } from "./admin.schema";

export const ADMIN_ROUTER_ROOT = "/admin";

const adminRouter = new MagicRouter(ADMIN_ROUTER_ROOT);

adminRouter.get("/stats", {}, canAccess("roles", ["SUPER_ADMIN"]), handleGetStats);
adminRouter.get("/users", { requestType: { query: AdminListQuerySchema } }, canAccess("roles", ["SUPER_ADMIN"]), handleGetUsers);
adminRouter.get("/voice-interviews", { requestType: { query: AdminListQuerySchema } }, canAccess("roles", ["SUPER_ADMIN"]), handleGetVoiceInterviews);

export default adminRouter.getRouter();
