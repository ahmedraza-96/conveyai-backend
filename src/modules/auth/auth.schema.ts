import validator from "validator";
import z from "zod";
import { passwordValidationSchema } from "../../common/common.schema";
import { isValidUsername } from "../../utils/isUsername";
import { baseCreateUser } from "../user/user.schema";
import { VOICE_OPTION_IDS } from "../voice-interview/voice-options";

export const resetPasswordSchema = z.object({
	userId: z
		.string({ required_error: "userId is required" })
		.min(1)
		.refine((value) => validator.isMongoId(value), "userId must be valid"),
	code: z
		.string({ required_error: "code is required" })
		.min(4)
		.max(4)
		.refine((value) => validator.isAlphanumeric(value), "code must be valid"),
	password: passwordValidationSchema("Password"),
	confirmPassword: passwordValidationSchema("Confirm password"),
});

export const changePasswordSchema = z.object({
	currentPassword: passwordValidationSchema("Current password"),
	newPassword: passwordValidationSchema("New password"),
});

export const forgetPasswordSchema = z.object({
	email: z
		.string({ required_error: "Email is required" })
		.email("Email must be valid"),
});

export const registerUserByEmailSchema = z
	.object({
		name: z.string({ required_error: "Name is required" }).min(1),
		confirmPassword: passwordValidationSchema("Confirm Password"),
		jobDescription: z
			.string()
			.optional()
			.refine(
				(val) => !val || (val.length >= 10 && val.length <= 5000),
				"Job description must be between 10 and 5000 characters if provided",
			),
	})
	.merge(baseCreateUser)
	.strict()
	.refine(({ password, confirmPassword }) => {
		if (password !== confirmPassword) {
			return false;
		}

		return true;
	}, "Password and confirm password must be same");

export const loginUserByEmailSchema = z.object({
	email: z
		.string({ required_error: "Email is required" })
		.email({ message: "Email is not valid" }),
	password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
	name: z.string().min(1).optional(),
	username: z
		.string()
		.min(1)
		.refine((value) => isValidUsername(value), "Username must be valid")
		.optional(),
	email: z.string().email("Email must be valid").optional(),
	jobDescription: z
		.string()
		.optional()
		.refine(
			(val) => !val || (val.length >= 10 && val.length <= 5000),
			"Job description must be between 10 and 5000 characters if provided",
		),
	preferredLanguage: z.enum(["english", "urdu", "roman_urdu"]).optional(),
	preferredVoiceId: z
		.enum(VOICE_OPTION_IDS as unknown as [string, ...string[]])
		.optional(),
});

export type RegisterUserByEmailSchemaType = z.infer<
	typeof registerUserByEmailSchema
>;

export type LoginUserByEmailSchemaType = z.infer<typeof loginUserByEmailSchema>;
export type ChangePasswordSchemaType = z.infer<typeof changePasswordSchema>;
export type ForgetPasswordSchemaType = z.infer<typeof forgetPasswordSchema>;
export type ResetPasswordSchemaType = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileSchemaType = z.infer<typeof updateProfileSchema>;
