import { describe, expect, it } from "vitest";
import {
  compareHash,
  hashPassword,
  signToken,
  verifyToken,
  type JwtPayload,
} from "../utils/auth.utils";

describe("auth.utils", () => {
  describe("hashPassword + compareHash", () => {
    it("hashes a password to a non-empty string different from the input", async () => {
      const plain = "correct-horse-battery-staple";
      const hashed = await hashPassword(plain);

      expect(hashed).toBeTypeOf("string");
      expect(hashed.length).toBeGreaterThan(0);
      expect(hashed).not.toBe(plain);
    });

    it("compareHash returns true for the matching plaintext", async () => {
      const plain = "correct-horse-battery-staple";
      const hashed = await hashPassword(plain);

      await expect(compareHash(hashed, plain)).resolves.toBe(true);
    });

    it("compareHash returns false for a non-matching plaintext", async () => {
      const hashed = await hashPassword("right-password");

      await expect(compareHash(hashed, "wrong-password")).resolves.toBe(false);
    });
  });

  describe("signToken + verifyToken", () => {
    const payload: JwtPayload = {
      sub: "user-123",
      email: "user@example.com",
      phoneNo: null,
      username: "user123",
      role: "DEFAULT_USER" as JwtPayload["role"],
    };

    it("round-trips a payload through sign + verify", async () => {
      const token = await signToken(payload);
      expect(token).toBeTypeOf("string");
      expect(token.split(".")).toHaveLength(3); // JWT shape

      const decoded = await verifyToken<JwtPayload>(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.username).toBe(payload.username);
    });

    it("verifyToken rejects a malformed token", async () => {
      await expect(verifyToken("not.a.valid.jwt")).rejects.toThrow();
    });
  });
});
