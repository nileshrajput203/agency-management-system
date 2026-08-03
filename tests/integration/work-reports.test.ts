import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../artifacts/api-server/src/app";
import { signToken } from "../../artifacts/api-server/src/lib/jwt";

describe("Work Reports API Integration Tests (/api/work-reports)", () => {
  const adminToken = signToken("9df7d339-addb-4f1f-9e72-ee9b29d21ada");
  let createdReportId: string;

  it("GET /api/work-reports should return HTTP 200 and array", async () => {
    const res = await request(app)
      .get("/api/work-reports")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/v1/work-reports should also return HTTP 200 (versioning check)", async () => {
    const res = await request(app)
      .get("/api/v1/work-reports")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /api/work-reports should create a new report draft", async () => {
    const res = await request(app)
      .post("/api/work-reports")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Test Audit Monthly Report",
        period: "Monthly",
        employeeName: "John Doe",
        employeeDesignation: "Senior Developer",
        clientHandled: "Acme Corp",
        projects: [
          {
            id: "p-1",
            projectName: "Portal Redesign",
            clientName: "Acme Corp",
            taskDescription: "Built Work Report module",
            completionPercentage: 100,
            hoursSpent: 40,
            status: "Completed",
          },
        ],
        selfAssessment: "Delivered all goals on time.",
        summary: "Excellent progress made.",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe("Draft");
    createdReportId = res.body.id;
  });

  it("GET /api/work-reports/:id should fetch single report with details", async () => {
    const res = await request(app)
      .get(`/api/work-reports/${createdReportId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdReportId);
    expect(res.body.title).toBe("Test Audit Monthly Report");
    expect(Array.isArray(res.body.versions)).toBe(true);
    expect(Array.isArray(res.body.auditLogs)).toBe(true);
  });

  it("PUT /api/work-reports/:id should update draft report", async () => {
    const res = await request(app)
      .put(`/api/work-reports/${createdReportId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Updated Test Audit Monthly Report",
        summary: "Updated summary text.",
      });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated Test Audit Monthly Report");
  });

  it("POST /api/work-reports/:id/submit should submit report", async () => {
    const res = await request(app)
      .post(`/api/work-reports/${createdReportId}/submit`)
      .set("Authorization", `Bearer ${adminToken}`);

    if (res.status !== 200) console.error("SUBMIT ERROR:", res.status, res.body);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Submitted");
  });

  it("POST /api/work-reports/:id/review-status should change status to Under Review", async () => {
    const res = await request(app)
      .post(`/api/work-reports/${createdReportId}/review-status`)
      .set("Authorization", `Bearer ${adminToken}`);

    if (res.status !== 200) console.error("REVIEW-STATUS ERROR:", res.status, res.body);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Under Review");
  });

  it("POST /api/work-reports/:id/request-changes should set status to Needs Changes", async () => {
    const res = await request(app)
      .post(`/api/work-reports/${createdReportId}/request-changes`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        managerFeedback: "Please add more details to self assessment.",
      });

    if (res.status !== 200) console.error("REQUEST-CHANGES ERROR:", res.status, res.body);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Needs Changes");
    expect(res.body.managerFeedback).toBe("Please add more details to self assessment.");
  });

  it("POST /api/work-reports/:id/approve should approve report", async () => {
    const res = await request(app)
      .post(`/api/work-reports/${createdReportId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Approved");
    expect(res.body.approvedAt).toBeDefined();
  });

  it("POST /api/work-reports/:id/request-reopen should create reopen request", async () => {
    const res = await request(app)
      .post(`/api/work-reports/${createdReportId}/request-reopen`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reason: "Need to update project completion percentage.",
      });

    expect(res.status).toBe(200);
    expect(res.body.reopenRequested).toBe(true);
    expect(res.body.reopenStatus).toBe("Pending");
  });

  it("POST /api/work-reports/:id/review-reopen should approve reopen request", async () => {
    const res = await request(app)
      .post(`/api/work-reports/${createdReportId}/review-reopen`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        action: "approve",
        reviewComment: "Approved by manager.",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Needs Changes");
    expect(res.body.reopenStatus).toBe("Approved");
  });

  it("GET /api/work-reports/:id/pdf should generate printable HTML PDF view", async () => {
    const res = await request(app)
      .get(`/api/work-reports/${createdReportId}/pdf`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain("BLINK BEYOND");
    expect(res.text).toContain("Updated Test Audit Monthly Report");
  });

  it("POST /api/work-reports/:id/archive should archive report", async () => {
    const res = await request(app)
      .post(`/api/work-reports/${createdReportId}/archive`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Archived");
  });

  it("POST /api/work-reports/:id/restore should restore report", async () => {
    const res = await request(app)
      .post(`/api/work-reports/${createdReportId}/restore`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it("DELETE /api/work-reports/:id should delete report", async () => {
    const delRes = await request(app)
      .delete(`/api/work-reports/${createdReportId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(delRes.status).toBe(200);
  });
});
