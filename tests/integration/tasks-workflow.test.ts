import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../artifacts/api-server/src/app";
import { getTestAdmin } from "../test-helper";
import { db } from "@workspace/db";
import { usersTable, tasksTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { signToken } from "../../artifacts/api-server/src/lib/jwt";

describe("Tasks Workflow Integration Tests (/api/tasks)", () => {
  let adminToken: string;
  let adminId: string;
  let employeeToken: string;
  let employeeId: string;
  let testTaskId: string;

  beforeAll(async () => {
    const admin = await getTestAdmin();
    adminToken = admin.token;
    adminId = admin.id;

    // Find or create an employee user
    const [existingEmp] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.systemRole, "EMPLOYEE"))
      .limit(1);

    if (existingEmp) {
      employeeId = existingEmp.id;
    } else {
      const [newEmp] = await db
        .insert(usersTable)
        .values({
          name: "Test Workflow Employee",
          email: `test-emp-${Date.now()}@example.com`,
          passwordHash: "dummyhash123",
          systemRole: "EMPLOYEE",
          role: "EMPLOYEE",
        })
        .returning({ id: usersTable.id });
      employeeId = newEmp.id;
    }
    employeeToken = signToken(employeeId);
  }, 20000);

  it("Admin/Manager creates an approved task", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Workflow Test Task",
        description: "Task for workflow integration testing",
        status: "TODO",
        priority: "MEDIUM",
        assigneeId: employeeId,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe("TODO");
    expect(res.body.approvalStatus).toBe("APPROVED");
    testTaskId = res.body.id;
  });

  it("Employee can update task status to IN_PROGRESS", async () => {
    const res = await request(app)
      .patch(`/api/tasks/${testTaskId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        status: "IN_PROGRESS",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_PROGRESS");
  });

  it("Employee can update task status to IN_REVIEW (Send for Review)", async () => {
    const res = await request(app)
      .patch(`/api/tasks/${testTaskId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        status: "IN_REVIEW",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_REVIEW");
  });

  it("Employee attempting to set status to DONE is automatically redirected to IN_REVIEW", async () => {
    const res = await request(app)
      .patch(`/api/tasks/${testTaskId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        status: "DONE",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_REVIEW");
  });

  it("Employee updating task with extra fields (title, priority) updates notes without 403 error", async () => {
    const res = await request(app)
      .patch(`/api/tasks/${testTaskId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        title: "Employee Should Not Change Title",
        priority: "URGENT",
        description: "Updated progress notes by employee",
        status: "IN_PROGRESS",
      });

    expect(res.status).toBe(200);
    expect(res.body.description).toBe("Updated progress notes by employee");
    expect(res.body.title).toBe("Workflow Test Task"); // Title was preserved, extra field stripped
    expect(res.body.status).toBe("IN_PROGRESS");
  });

  it("Employee can revert task from IN_REVIEW back to IN_PROGRESS if sent by mistake", async () => {
    // First ensure task is IN_REVIEW
    await request(app)
      .patch(`/api/tasks/${testTaskId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ status: "IN_REVIEW" });

    // Revert back to IN_PROGRESS
    const res = await request(app)
      .patch(`/api/tasks/${testTaskId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        status: "IN_PROGRESS",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_PROGRESS");
  });

  it("Employee can revert task from IN_PROGRESS back to TODO if started by mistake", async () => {
    const res = await request(app)
      .patch(`/api/tasks/${testTaskId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        status: "TODO",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("TODO");
  });

  it("Employee can move task directly from IN_REVIEW back to TODO", async () => {
    // Set to IN_REVIEW first
    await request(app)
      .patch(`/api/tasks/${testTaskId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ status: "IN_REVIEW" });

    // Revert directly to TODO
    const res = await request(app)
      .patch(`/api/tasks/${testTaskId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        status: "TODO",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("TODO");
  });

  it("Manager can set status to DONE (Approve & Complete)", async () => {
    const res = await request(app)
      .patch(`/api/tasks/${testTaskId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "DONE",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("DONE");
    expect(res.body.approvalStatus).toBe("APPROVED");
  });

  it("Cleanup test task", async () => {
    if (testTaskId) {
      await db.delete(tasksTable).where(eq(tasksTable.id, testTaskId));
    }
  });
});

