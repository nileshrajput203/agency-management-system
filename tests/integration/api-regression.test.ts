import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../artifacts/api-server/src/app";
import { signToken } from "../../artifacts/api-server/src/lib/jwt";

describe("API Regression & Versioning Integration Tests (/api vs /api/v1)", () => {
  const adminToken = signToken("9df7d339-addb-4f1f-9e72-ee9b29d21ada");

  const endpointsToTest = [
    "/health",
    "/users",
    "/meetings",
    "/invoices",
    "/notifications",
    "/leads",
    "/attendance",
    "/work-reports",
  ];

  it("should respond identically for health endpoint on both legacy and v1 routes", async () => {
    const legacyRes = await request(app).get("/api/health");
    const v1Res = await request(app).get("/api/v1/health");

    expect(legacyRes.status).toBe(200);
    expect(v1Res.status).toBe(200);
    expect(legacyRes.body).toEqual(v1Res.body);
    expect(legacyRes.body).toEqual({ status: "ok" });
  });

  for (const endpoint of endpointsToTest) {
    if (endpoint === "/health") continue;

    it(`should return matching response status for authenticated GET ${endpoint}`, async () => {
      const legacyRes = await request(app)
        .get(`/api${endpoint}`)
        .set("Authorization", `Bearer ${adminToken}`);

      const v1Res = await request(app)
        .get(`/api/v1${endpoint}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(legacyRes.status).toBe(v1Res.status);
      expect(legacyRes.status).toBe(200);

      // Verify response structures match
      if (Array.isArray(legacyRes.body)) {
        expect(Array.isArray(v1Res.body)).toBe(true);
        expect(legacyRes.body.length).toBe(v1Res.body.length);
      } else {
        expect(typeof legacyRes.body).toBe(typeof v1Res.body);
      }
    });
  }

  it("should handle auth endpoints identically across versions", async () => {
    const legacyRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "invalid@example.com", password: "wrong" });

    const v1Res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "invalid@example.com", password: "wrong" });

    expect(legacyRes.status).toBe(401);
    expect(v1Res.status).toBe(401);
    expect(legacyRes.body).toEqual(v1Res.body);
  });
});
