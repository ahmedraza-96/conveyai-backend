import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist"],
    env: {
      // Minimal env required by src/config/config.service.ts (Zod-validated on import).
      // Real values aren't needed — these are just shape-valid placeholders so module imports succeed.
      NODE_ENV: "development",
      PORT: "3000",
      REDIS_URL: "redis://localhost:6379",
      MONGO_DATABASE_URL: "mongodb://localhost:27017/test",
      CLIENT_SIDE_URL: "http://localhost:3000",
      BACKEND_URL: "http://localhost:3000",
      JWT_SECRET: "test-secret-key-do-not-use-in-prod",
      JWT_EXPIRES_IN: "86400",
      SESSION_EXPIRES_IN: "86400",
      PASSWORD_RESET_TOKEN_EXPIRES_IN: "86400",
      SET_PASSWORD_TOKEN_EXPIRES_IN: "86400",
      AWS_ACCESS_KEY_ID: "test-key",
      AWS_SECRET_ACCESS_KEY: "test-secret",
      AWS_REGION: "us-east-1",
      AWS_S3_BUCKET_NAME: "test-bucket",
      MAILGUN_API_KEY: "test-key",
      MAILGUN_DOMAIN: "test.local",
      MAILGUN_FROM_EMAIL: "noreply@test.local",
      ADMIN_EMAIL: "admin@test.local",
      ADMIN_PASSWORD: "test-password",
      OTP_VERIFICATION_ENABLED: "0",
      GOOGLE_GEMINI_API_KEY: "test-key",
      OPENAI_API_KEY: "test-key",
      VAPI_API_KEY: "test-key",
      VAPI_PUBLIC_KEY: "test-key",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.{test,spec}.ts",
        "src/main.ts",
        "src/seeder.ts",
        "src/openapi/**",
        "src/email/templates/**",
      ],
    },
  },
});
