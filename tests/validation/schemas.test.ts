import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../artifacts/api-server/src/app";
import { signToken } from "../../artifacts/api-server/src/lib/jwt";

describe("Validation Tests (Payload & Schema Boundaries)", () => {
  const adminToken = signToken("9df7d339-addb-4f1f-9e72-ee9b29d21ada");

  describe("Login Endpoint Validation", () => {
    it("should fail when email or password is missing", async () => {
      const res = await request(app).post("/api/auth/login").send({ email: "admin@agency.com" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/email and password are required/i);
    });

    it("should work through both /api/auth/login and /api/v1/auth/login", async () => {
      const legacyRes = await request(app).post("/api/auth/login").send({});
      const v1Res = await request(app).post("/api/v1/auth/login").send({});
      expect(legacyRes.status).toBe(400);
      expect(v1Res.status).toBe(400);
    });
  });

  describe("Invoices Endpoint Validation", () => {
    it("should reject invoice creation with invalid client UUID", async () => {
      const res = await request(app)
        .post("/api/invoices")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          clientId: "invalid-uuid",
          status: "DRAFT",
          invoiceNumber: "INV-9999",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid UUID/i);
    });
  });

  describe("Meetings Endpoint Validation", () => {
    it("should reject meeting creation with invalid date or timestamp", async () => {
      const res = await request(app)
        .post("/api/meetings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Strategy Meeting",
          startTime: "not-a-valid-date",
          endTime: "2026-07-30T10:00:00Z",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid start or end time format/i);
    });
  });
});
