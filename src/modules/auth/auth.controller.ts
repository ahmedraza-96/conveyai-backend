import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import config from "../../config/config.service";
import type { GoogleCallbackQuery } from "../../types";
import { errorResponse, successResponse } from "../../utils/api.utils";
import type { JwtPayload } from "../../utils/auth.utils";
import { AUTH_COOKIE_KEY, COOKIE_CONFIG } from "./auth.constants";
import type {
	ChangePasswordSchemaType,
	ForgetPasswordSchemaType,
	LoginUserByEmailSchemaType,
	RegisterUserByEmailSchemaType,
	ResetPasswordSchemaType,
	UpdateProfileSchemaType,
} from "./auth.schema";
import { registerUserByEmailSchema, updateProfileSchema } from "./auth.schema";
import {
	changePassword,
	forgetPassword,
	getProfile,
	getUserNameAndEmail,
	googleLogin,
	googleLoginWithIdToken,
	loginUserByEmail,
	registerUserByEmail,
	resetPassword,
	updateProfile,
} from "./auth.service";

export const handleResetPassword = async (
	req: Request<unknown, unknown, ResetPasswordSchemaType>,
	res: Response,
) => {
	await resetPassword(req.body);

	return successResponse(res, "Password successfully reset");
};

export const handleForgetPassword = async (
	req: Request<unknown, unknown, ForgetPasswordSchemaType>,
	res: Response,
) => {
	const user = await forgetPassword(req.body);

	return successResponse(res, "Code has been sent", { userId: user._id });
};

export const handleChangePassword = async (
	req: Request<unknown, unknown, ChangePasswordSchemaType>,
	res: Response,
) => {
	await changePassword((req.user as JwtPayload).sub, req.body);

	return successResponse(res, "Password successfully changed");
};

export const handleRegisterUser = async (
	req: Request<unknown, unknown, RegisterUserByEmailSchemaType>,
	res: Response,
) => {
	// Multer has already processed the multipart/form-data
	// Extract resume file and jobDescription from the request
	const file = req.file as Express.Multer.File & { location?: string };
	const resumeUrl = file?.location || null;
	
	// Validate the body data (jobDescription and other fields are in req.body after multer)
	const validationResult = registerUserByEmailSchema.safeParse(req.body);
	
	if (!validationResult.success) {
		return errorResponse(
			res,
			"Invalid input",
			StatusCodes.BAD_REQUEST,
			validationResult.error,
		);
	}

	const validatedData = validationResult.data;
	
	// Pass resume URL and validated data to service
	const user = await registerUserByEmail({
		...validatedData,
		resume: resumeUrl || undefined,
	});

	if (config.OTP_VERIFICATION_ENABLED) {
		return successResponse(res, "Please check your email for OTP", user);
	}

	return successResponse(res, "User has been reigstered", user);
};

export const handleLogout = async (_: Request, res: Response) => {
	res.cookie(AUTH_COOKIE_KEY, undefined, COOKIE_CONFIG);

	return successResponse(res, "Logout successful");
};

export const handleLoginByEmail = async (
	req: Request<unknown, unknown, LoginUserByEmailSchemaType>,
	res: Response,
) => {
	const token = await loginUserByEmail(req.body);
	if (config.SET_SESSION) {
		res.cookie(AUTH_COOKIE_KEY, token, COOKIE_CONFIG);
	}
	return successResponse(res, "Login successful", { token: token });
};

export const handleGetCurrentUser = async (req: Request, res: Response) => {
	const user = req.user;

	return successResponse(res, undefined, user);
};

export const handleGetProfile = async (req: Request, res: Response) => {
	const userId = (req.user as JwtPayload).sub;
	const user = await getProfile(userId);

	return successResponse(res, undefined, user);
};

export const handleUpdateProfile = async (
	req: Request<unknown, unknown, UpdateProfileSchemaType>,
	res: Response,
) => {
	// Multer has already processed the multipart/form-data if a file was uploaded
	// Extract resume file from the request
	const file = req.file as Express.Multer.File & { location?: string };
	const resumeUrl = file?.location || undefined;

	// Validate the body data (other fields are in req.body after multer)
	const validationResult = updateProfileSchema.safeParse(req.body);

	if (!validationResult.success) {
		return errorResponse(
			res,
			"Invalid input",
			StatusCodes.BAD_REQUEST,
			validationResult.error,
		);
	}

	const validatedData = validationResult.data;

	// Pass resume URL and validated data to service
	// Only include resume if a new file was uploaded
	const updatePayload: UpdateProfileSchemaType & { resume?: string } = {
		...validatedData,
	};
	if (resumeUrl) {
		updatePayload.resume = resumeUrl;
	}

	const user = await updateProfile((req.user as JwtPayload).sub, updatePayload);

	return successResponse(res, "Profile updated successfully", user);
};

export const handleGetUserNameAndEmail = async (
	req: Request,
	res: Response,
) => {
	const userId = (req.user as JwtPayload).sub;
	const userData = await getUserNameAndEmail(userId);

	return successResponse(res, undefined, userData);
};
export const handleGoogleIdTokenLogin = async (
	req: Request<unknown, unknown, { idToken: string }>,
	res: Response,
) => {
	const { idToken } = req.body;
	if (!idToken) {
		return errorResponse(res, "idToken is required", StatusCodes.BAD_REQUEST);
	}
	const token = await googleLoginWithIdToken(idToken);
	if (config.SET_SESSION) {
		res.cookie(AUTH_COOKIE_KEY, token, COOKIE_CONFIG);
	}
	return successResponse(res, "Login successful", { token });
};

export const handleGoogleLogin = async (_: Request, res: Response) => {
	if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_REDIRECT_URI) {
		throw new Error("Google credentials are not set");
	}

	const googleAuthURL = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${config.GOOGLE_CLIENT_ID}&redirect_uri=${config.GOOGLE_REDIRECT_URI}&scope=email profile`;

	res.redirect(googleAuthURL);
};
export const handleGoogleCallback = async (
	req: Request<unknown, unknown, unknown, GoogleCallbackQuery>,
	res: Response,
) => {
	const user = await googleLogin(req.query);
	if (!user) throw new Error("Failed to login");
	res.cookie(
		AUTH_COOKIE_KEY,
		user.socialAccount?.[0]?.accessToken,
		COOKIE_CONFIG,
	);

	return successResponse(res, "Logged in successfully", {
		token: user.socialAccount?.[0]?.accessToken,
	});
};
