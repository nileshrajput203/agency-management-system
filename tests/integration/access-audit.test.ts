import { describe, expect, it } from "vitest";
import request from "supertest";
import { desc, eq } from "drizzle-orm";
import app from "../../artifacts/api-server/src/app";
import { signToken } from "../../artifacts/api-server/src/lib/jwt";
import { db } from "@workspace/db";
import { auditLogsTable, rolesTable, usersTable } from "@workspace/db/schema";

describe("access audit trail integration", () => {
  it("records the actor, target, action, and access details for every account access change", async () => {
    const [admin] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.systemRole, "SUPER_ADMIN"))
      .limit(1);

    expect(admin?.id, "A SUPER_ADMIN account is required for this verification").toBeTruthy();
    const token = signToken(admin!.id);
    const email = `audit-verification-${crypto.randomUUID()}@example.test`;
    const roleName = `AUDIT_REVIEWER_${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    let createdId: string | undefined;
    let roleId: string | undefined;

    try {
      const createdRole = await request(app)
        .post("/api/roles")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: roleName, description: "Temporary audit verification role" });
      expect(createdRole.status).toBe(201);
      roleId = createdRole.body.id;

      const roleLogs = await db
        .select()
        .from(auditLogsTable)
        .where(eq(auditLogsTable.targetUserName, `Role: ${roleName}`));
      expect(roleLogs).toEqual(expect.arrayContaining([
        expect.objectContaining({
          adminUserId: admin!.id,
          action: "ROLE_CREATED",
          targetUserName: `Role: ${roleName}`,
        }),
      ]));

      const created = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Audit Verification User",
          email,
          password: "AuditVerificationPassword!123",
          systemRole: roleName,
          allowedModules: ["content"],
        });

      expect(created.status).toBe(201);
      createdId = created.body.id;

      const updated = await request(app)
        .patch(`/api/users/${createdId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          systemRole: "Audit Reviewer",
          allowedModules: ["projects", "tasks"],
          isDelegatedAdmin: true,
          portalMode: "MODE_2",
          viewAllClients: true,
          auditReason: "Verify section-level access changes",
        });
      expect(updated.status).toBe(200);

      const revoked = await request(app)
        .patch(`/api/users/${createdId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          allowedModules: [],
          isDelegatedAdmin: false,
          isActive: false,
          auditReason: "Verify access revocation",
        });
      expect(revoked.status).toBe(200);

      const deleted = await request(app)
        .delete(`/api/users/${createdId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(deleted.status).toBe(204);
      const auditTargetId = createdId;

      const logs = await db
        .select()
        .from(auditLogsTable)
        .where(eq(auditLogsTable.targetUserId, auditTargetId))
        .orderBy(desc(auditLogsTable.createdAt));

      expect(logs.map((log) => log.action)).toEqual(expect.arrayContaining([
        "USER_ACCESS_CREATED",
        "USER_ACCESS_UPDATED",
        "DELEGATED_ACCESS_REVOKED",
        "USER_ACCESS_DELETED",
      ]));

      for (const log of logs) {
        expect(log.adminUserId).toBe(admin!.id);
        expect(log.targetUserId).toBe(auditTargetId);
        expect(log.targetUserName).toBe("Audit Verification User");
        expect(log.createdAt).toBeInstanceOf(Date);
      }

      const updateLog = logs.find((log) => log.action === "USER_ACCESS_UPDATED");
      expect(updateLog?.permissionsAdded).toEqual(["projects", "tasks"]);
      expect(JSON.parse(updateLog!.details || "{}")).toMatchObject({
        changedFields: expect.arrayContaining(["systemRole", "allowedModules", "isDelegatedAdmin"]),
        before: { allowedModules: ["content"] },
        after: { allowedModules: ["projects", "tasks"] },
      });

      const revokeLog = logs.find((log) => log.action === "DELEGATED_ACCESS_REVOKED");
      expect(revokeLog?.permissionsRemoved).toEqual(["projects", "tasks"]);
      expect(revokeLog?.reason).toBe("Verify access revocation");
      createdId = undefined;
    } finally {
      if (createdId) {
        await request(app)
          .delete(`/api/users/${createdId}`)
          .set("Authorization", `Bearer ${token}`);
      }
      if (roleId) {
        await db.delete(rolesTable).where(eq(rolesTable.id, roleId));
      }
    }
  }, 45_000);
});