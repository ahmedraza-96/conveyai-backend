import { canAccess } from "../../middlewares/can-access.middleware";
import { uploadResume } from "../../middlewares/multer-s3.middleware";
import MagicRouter from "../../openapi/magic-router";
import {
	handleChangePassword,
	handleForgetPassword,
	handleGetCurrentUser,
	handleGetProfile,
	handleGetUserNameAndEmail,
	handleGoogleCallback,
	handleGoogleIdTokenLogin,
	handleGoogleLogin,
	handleLoginByEmail,
	handleLogout,
	handleRegisterUser,
	handleResetPassword,
	handleUpdateProfile,
} from "./auth.controller";
import {
	changePasswordSchema,
	forgetPasswordSchema,
	loginUserByEmailSchema,
	resetPasswordSchema,
} from "./auth.schema";

export const AUTH_ROUTER_ROOT = "/auth";

const authRouter = new MagicRouter(AUTH_ROUTER_ROOT);

authRouter.post(
	"/login/email",
	{ requestType: { body: loginUserByEmailSchema } },
	handleLoginByEmail,
);

authRouter.post(
	"/register/email",
	{ requestType: {} }, // Body validation handled manually in controller after multer processes form data
	uploadResume,
	handleRegisterUser,
);

authRouter.post("/logout", {}, handleLogout);

authRouter.get("/me", {}, canAccess(), handleGetCurrentUser);

authRouter.get("/profile", {}, canAccess(), handleGetProfile);

authRouter.get("/user-info", {}, canAccess(), handleGetUserNameAndEmail);

authRouter.put(
	"/profile",
	{ requestType: {} }, // Body validation handled manually in controller after multer processes form data
	canAccess(),
	uploadResume,
	handleUpdateProfile,
);

authRouter.post(
	"/forget-password",
	{ requestType: { body: forgetPasswordSchema } },
	handleForgetPassword,
);

authRouter.post(
	"/change-password",
	{ requestType: { body: changePasswordSchema } },
	canAccess(),
	handleChangePassword,
);

authRouter.post(
	"/reset-password",
	{ requestType: { body: resetPasswordSchema } },
	handleResetPassword,
);

authRouter.get("/google", {}, handleGoogleLogin);
authRouter.get("/google/callback", {}, handleGoogleCallback);
authRouter.post("/google/token", {}, handleGoogleIdTokenLogin);

export default authRouter.getRouter();
