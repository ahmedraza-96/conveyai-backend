import { describe, expect, it } from "vitest";
import { createVoiceInterviewSchema } from "../modules/voice-interview/voice-interview.schema";

describe("createVoiceInterviewSchema", () => {
  const validPayload = {
    mode: "topic",
    interviewType: "technical",
    duration: 15,
    difficulty: "medium",
    topic: "JavaScript",
  };

  it("accepts a minimal valid payload", () => {
    const result = createVoiceInterviewSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("defaults personality to 'professional' when omitted", () => {
    const result = createVoiceInterviewSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.personality).toBe("professional");
    }
  });

  it("rejects an invalid mode value", () => {
    const result = createVoiceInterviewSchema.safeParse({
      ...validPayload,
      mode: "not-a-mode",
    });
    expect(result.success).toBe(false);
  });

  it("rejects duration shorter than 2 minutes", () => {
    const result = createVoiceInterviewSchema.safeParse({
      ...validPayload,
      duration: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects duration longer than 60 minutes", () => {
    const result = createVoiceInterviewSchema.safeParse({
      ...validPayload,
      duration: 90,
    });
    expect(result.success).toBe(false);
  });

  it("rejects jobDescription longer than 5000 chars", () => {
    const result = createVoiceInterviewSchema.safeParse({
      ...validPayload,
      jobDescription: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});
