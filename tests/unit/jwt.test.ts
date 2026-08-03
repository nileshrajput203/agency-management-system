import { describe, it, expect } from "vitest";
import { signToken, verifyToken, signRefreshToken, verifyRefreshToken } from "../../artifacts/api-server/src/lib/jwt";

describe("JWT Unit Tests", () => {
  it("should sign and verify access token successfully", () => {
    const userId = "user-test-123";
    const token = signToken(userId);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const payload = verifyToken(token);
    expect(payload.sub).toBe(userId);
    expect(payload.iat).toBeTypeOf("number");
    expect(payload.exp).toBeTypeOf("number");
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("should sign and verify refresh token successfully", () => {
    const userId = "user-test-456";
    const refreshToken = signRefreshToken(userId);
    expect(refreshToken).toBeDefined();

    const payload = verifyRefreshToken(refreshToken);
    expect(payload.sub).toBe(userId);
    expect(payload.type).toBe("refresh");
  });

  it("should reject invalid token signature", () => {
    const userId = "user-test-789";
    const token = signToken(userId);
    const tamperedToken = token.slice(0, -5) + "abcde";

    expect(() => verifyToken(tamperedToken)).toThrow(/Invalid signature/i);
  });

  it("should reject malformed token string", () => {
    expect(() => verifyToken("invalid-token-string")).toThrow(/Invalid token structure/i);
    expect(() => verifyToken("")).toThrow(/Invalid token format/i);
  });

  it("should reject access token passed as refresh token", () => {
    const token = signToken("user-1");
    expect(() => verifyRefreshToken(token)).toThrow(/Invalid refresh token type/i);
  });
});
