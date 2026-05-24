import config from "../../config/config.service";
import { ROLE_ENUM, type RoleType, SOCIAL_ACCOUNT_ENUM } from "../../enums";
import type { GoogleCallbackQuery } from "../../types";
import {
	type JwtPayload,
	compareHash,
	fetchGoogleTokens,
	generateOTP,
	getUserInfo,
	hashPassword,
	signToken,
	verifyGoogleIdToken,
} from "../../utils/auth.utils";
import { generateRandomNumbers } from "../../utils/common.utils";
import type { UserType } from "../user/user.dto";
import {
	createUser,
	getUserByEmail,
	getUserById,
	updateUser,
} from "../user/user.services";
import User from "../user/user.model";
import type {
	ChangePasswordSchemaType,
	ForgetPasswordSchemaType,
	LoginUserByEmailSchemaType,
	RegisterUserByEmailSchemaType,
	ResetPasswordSchemaType,
	UpdateProfileSchemaType,
} from "./auth.schema";

export const resetPassword = async (payload: ResetPasswordSchemaType) => {
	const user = await getUserById(payload.userId);

	if (!user || user.passwordResetCode !== payload.code) {
		throw new Error("token is not valid or expired, please try again");
	}

	if (payload.confirmPassword !== payload.password) {
		throw new Error("Password and confirm password must be same");
	}

	const hashedPassword = await hashPassword(payload.password);

	await updateUser(payload.userId, {
		password: hashedPassword,
		passwordResetCode: null,
	});
};

export const forgetPassword = async (
	payload: ForgetPasswordSchemaType,
): Promise<UserType> => {
	const user = await getUserByEmail(payload.email);

	if (!user) {
		throw new Error("user doesn't exists");
	}

	const code = generateRandomNumbers(4);

	await updateUser(user._id, { passwordResetCode: code });

	return user;
};

export const changePassword = async (
	userId: string,
	payload: ChangePasswordSchemaType,
): Promise<void> => {
	const user = await getUserById(userId, "+password");

	if (!user || !user.password) {
		throw new Error("User is not found");
	}

	const isCurrentPassowordCorrect = await compareHash(
		user.password,
		payload.currentPassword,
	);

	if (!isCurrentPassowordCorrect) {
		throw new Error("current password is not valid");
	}

	const hashedPassword = await hashPassword(payload.newPassword);

	await updateUser(userId, { password: hashedPassword });
};

export const registerUserByEmail = async (
	payload: RegisterUserByEmailSchemaType & { resume?: string },
): Promise<UserType> => {
	const userExistByEmail = await getUserByEmail(payload.email);

	if (userExistByEmail) {
		throw new Error("Account already exist with same email address");
	}

	const { confirmPassword, resume, ...rest } = payload;

	const otp = config.OTP_VERIFICATION_ENABLED ? generateOTP() : null;

	const user = await createUser(
		{ 
			...rest, 
			role: "DEFAULT_USER", 
			otp,
			resume: resume,
		},
		false,
	);

	// Trigger interview preparation job if resume or job description exists
	if (resume || payload.jobDescription) {
		const { InterviewPrepQueue } = await import("../../queues/interview-prep.queue");
		await InterviewPrepQueue.add("generate-prep", {
			userId: String(user._id),
			resumeUrl: resume,
			jobDescription: payload.jobDescription,
		});
	}

	return user;
};

export const loginUserByEmail = async (
	payload: LoginUserByEmailSchemaType,
): Promise<string> => {
	const user = await getUserByEmail(payload.email, "+password");

	if (!user || !(await compareHash(String(user.password), payload.password))) {
		throw new Error("Invalid email or password");
	}

	const jwtPayload: JwtPayload = {
		sub: String(user._id),
		email: user?.email,
		phoneNo: user?.phoneNo,
		role: String(user.role) as RoleType,
		username: user.username,
	};

	const token = await signToken(jwtPayload);

	return token;
};

const buildUsernameFromEmail = (email: string): string => {
	const base = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 12);
	const safeBase = base.length >= 3 ? base : `user${base}`;
	const suffix = generateRandomNumbers(4);
	return `${safeBase}${suffix}`.slice(0, 16);
};

export const googleLoginWithIdToken = async (
	idToken: string,
): Promise<string> => {
	const payload = await verifyGoogleIdToken(idToken);
	const { sub, email, name, picture } = payload;

	let user = await getUserByEmail(email);

	const socialAccountEntry = {
		accountType: SOCIAL_ACCOUNT_ENUM.GOOGLE,
		accountID: sub,
		accessToken: "",
		refreshToken: "",
		tokenExpiry: new Date(),
	};

	if (!user) {
		user = await createUser({
			email,
			username: buildUsernameFromEmail(email),
			name: name || email.split("@")[0],
			avatar: picture,
			role: ROLE_ENUM.DEFAULT_USER,
			password: generateRandomNumbers(16),
			otp: null,
			socialAccount: [socialAccountEntry],
		});
	} else {
		user = await updateUser(user._id, {
			otp: null,
			socialAccount: [socialAccountEntry],
		});
	}

	const jwtPayload: JwtPayload = {
		sub: String(user._id),
		email: user.email,
		phoneNo: user.phoneNo,
		role: String(user.role) as RoleType,
		username: user.username,
	};

	return signToken(jwtPayload);
};

export const googleLogin = async (
	payload: GoogleCallbackQuery,
): Promise<UserType> => {
	const { code, error } = payload;

	if (error) {
		throw new Error(error);
	}

	if (!code) {
		throw new Error("Code Not Provided");
	}
	const tokenResponse = await fetchGoogleTokens({ code });

	const { access_token, refresh_token, expires_in } = tokenResponse;

	const userInfoResponse = await getUserInfo(access_token);

	const { id, email, name, picture } = userInfoResponse;

	const user = await getUserByEmail(email);

	if (!user) {
		const newUser = await createUser({
			email,
			username: name,
			avatar: picture,
			role: ROLE_ENUM.DEFAULT_USER,
			password: generateRandomNumbers(4),
			socialAccount: [
				{
					refreshToken: refresh_token,
					tokenExpiry: new Date(Date.now() + expires_in * 1000),
					accountType: SOCIAL_ACCOUNT_ENUM.GOOGLE,
					accessToken: access_token,
					accountID: id,
				},
			],
		});

		return newUser;
	}

	const updatedUser = await updateUser(user._id, {
		socialAccount: [
			{
				refreshToken: refresh_token,
				tokenExpiry: new Date(Date.now() + expires_in * 1000),
				accountType: SOCIAL_ACCOUNT_ENUM.GOOGLE,
				accessToken: access_token,
				accountID: id,
			},
		],
	});

	return updatedUser;
};

export const getProfile = async (userId: string): Promise<UserType> => {
	const user = await getUserById(userId);

	return user;
};

export const getUserNameAndEmail = async (
	userId: string,
): Promise<{ name?: string; email: string }> => {
	const user = await getUserById(userId);

	return {
		name: user.name,
		email: user.email,
	};
};

export const updateProfile = async (
	userId: string,
	payload: UpdateProfileSchemaType & { resume?: string },
): Promise<UserType> => {
	const currentUser = await getUserById(userId);

	// Check if email is being updated and if it's already taken by another user
	if (payload.email && payload.email !== currentUser.email) {
		const userWithEmail = await getUserByEmail(payload.email);
		if (userWithEmail && String(userWithEmail._id) !== userId) {
			throw new Error("Email is already taken by another user");
		}
	}

	// Check if username is being updated and if it's already taken by another user
	if (payload.username && payload.username !== currentUser.username) {
		const userWithUsername = await User.findOne({ username: payload.username });
		if (userWithUsername && String(userWithUsername._id) !== userId) {
			throw new Error("Username is already taken by another user");
		}
	}

	const updateData: Partial<UserType> = {};
	let resumeChanged = false;
	let jobDescriptionChanged = false;

	if (payload.name !== undefined) {
		updateData.name = payload.name;
	}
	if (payload.username !== undefined) {
		updateData.username = payload.username;
	}
	if (payload.email !== undefined) {
		updateData.email = payload.email;
	}
	if (payload.jobDescription !== undefined) {
		updateData.jobDescription = payload.jobDescription;
		jobDescriptionChanged = payload.jobDescription !== currentUser.jobDescription;
	}
	if (payload.resume !== undefined) {
		updateData.resume = payload.resume;
		resumeChanged = payload.resume !== currentUser.resume;
	}
	if (payload.preferredLanguage !== undefined) {
		updateData.preferredLanguage = payload.preferredLanguage;
	}
	if (payload.preferredVoiceId !== undefined) {
		updateData.preferredVoiceId = payload.preferredVoiceId;
	}

	const updatedUser = await updateUser(userId, updateData);

	// Trigger interview preparation job if resume or job description changed
	if (resumeChanged || jobDescriptionChanged) {
		const { InterviewPrepQueue } = await import("../../queues/interview-prep.queue");
		await InterviewPrepQueue.add("generate-prep", {
			userId: userId,
			resumeUrl: updatedUser.resume,
			jobDescription: updatedUser.jobDescription,
		});
	}

	return updatedUser;
};
