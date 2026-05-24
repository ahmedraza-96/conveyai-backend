import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// Remove .optional() from requried schema properties

const configSchema = z.object({
	REDIS_URL: z.string().url(),
	PORT: z.string().regex(/^\d+$/).transform(Number),
	MONGO_DATABASE_URL: z.string().url(),
	SMTP_HOST: z.string().min(1).optional(),
	SMTP_PORT: z.string().regex(/^\d+$/).transform(Number).optional(),
	SMTP_USERNAME: z.string().email().optional(),
	EMAIL_FROM: z.string().email().optional(),
	SMTP_FROM: z.string().min(1).optional(),
	SMTP_PASSWORD: z.string().min(1).optional(),
	CLIENT_SIDE_URL: z.string().url(),
	JWT_SECRET: z.string().min(1),
	JWT_EXPIRES_IN: z.string().default("86400").transform(Number),
	SESSION_EXPIRES_IN: z.string().default("86400").transform(Number),
	PASSWORD_RESET_TOKEN_EXPIRES_IN: z.string().default("86400").transform(Number),
	SET_PASSWORD_TOKEN_EXPIRES_IN: z.string().default("86400").transform(Number),
	STATIC_OTP: z.enum(["1", "0"]).transform(Number).optional(),
	NODE_ENV: z
		.union([z.literal("production"), z.literal("development")])
		.default("development")
		.optional(),
	SET_SESSION: z
		.string()
		.transform((value) => !!Number(value))
		.optional(),
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),
	GOOGLE_REDIRECT_URI: z.string().optional(),
	APP_NAME: z.string().default("API V2"),
	APP_VERSION: z.string().default("1.0.0"),
	// AWS S3 configuration
	AWS_ACCESS_KEY_ID: z.string().min(1),
	AWS_SECRET_ACCESS_KEY: z.string().min(1),
	AWS_REGION: z.string().min(1).default("us-east-1"),
	AWS_S3_BUCKET_NAME: z.string().min(1),
	// Mailgun configuration
	MAILGUN_API_KEY: z.string().min(1),
	MAILGUN_DOMAIN: z.string().min(1),
	MAILGUN_FROM_EMAIL: z.string().email(),
	ADMIN_EMAIL: z.string().email(),
	ADMIN_PASSWORD: z.string().min(1),
	OTP_VERIFICATION_ENABLED: z.string().transform((value) => !!Number(value)),
	GOOGLE_GEMINI_API_KEY: z.string().min(1).optional(),
	OPENAI_API_KEY: z.string().min(1),
	// Backend URL for webhooks
	BACKEND_URL: z.string().url(),
	// Vapi configuration
	VAPI_API_KEY: z.string().min(1),
	VAPI_PUBLIC_KEY: z.string().min(1),
	VAPI_WEBHOOK_SECRET: z.string().optional(),
	// TTS providers (used for voice preview samples)
	ELEVENLABS_API_KEY: z.string().optional(),
	AZURE_TTS_KEY: z.string().optional(),
	AZURE_TTS_REGION: z.string().optional(),
	// Tavus CVI (avatar interviews)
	TAVUS_API_KEY: z.string().optional(),
	TAVUS_PERSONA_MALE_ID: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

const config = configSchema.parse(process.env);

export default config;
