import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../artifacts/api-server/src/app";
import { signToken } from "../../artifacts/api-server/src/lib/jwt";

describe("Authorization & Access Control Tests", () => {
  it("should return 401 Unauthorized when requesting protected endpoints without token", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it("should return 401 Unauthorized when token is invalid or corrupted", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", "Bearer invalid.jwt.token");
    expect(res.status).toBe(401);
  });

  it("should allow access when valid superadmin JWT token is provided", async () => {
    // Admin user ID in bootstrap seed: 9df7d339-addb-4f1f-9e72-ee9b29d21ada
    const adminToken = signToken("9df7d339-addb-4f1f-9e72-ee9b29d21ada");

    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("should enforce authorization on versioned v1 route as well", async () => {
    const res = await request(app).get("/api/v1/users");
    expect(res.status).toBe(401);

    const adminToken = signToken("9df7d339-addb-4f1f-9e72-ee9b29d21ada");
    const v1Res = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(v1Res.status).toBe(200);
  });
});
