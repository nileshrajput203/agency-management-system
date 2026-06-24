import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";

const router = Router();

// Middleware to check if the current user is a SUPER_ADMIN
async function requireAdmin(req: any, res: any, next: any) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const [user] = await db
      .select({ systemRole: usersTable.systemRole })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    
    if (!user || user.systemRole !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }
    next();
  } catch (err) {
    console.error("requireAdmin middleware error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        systemRole: usersTable.systemRole,
        department: usersTable.department,
        isActive: usersTable.isActive,
        allowedModules: usersTable.allowedModules,
      })
      .from(usersTable);
    
    const parsedRows = rows.map(u => ({
      ...u,
      allowedModules: u.allowedModules ? JSON.parse(u.allowedModules) : [],
    }));
    return res.json(parsedRows);
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { name, email, password, systemRole, department, isActive, allowedModules } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
    if (existing) {
      return res.status(409).json({ error: "User with this email already exists" });
    }

    let passwordHash = null;
    if (password) {
      passwordHash = await hash(password, 12);
    }

    const insertData = {
      name,
      email,
      password: passwordHash,
      systemRole: systemRole || "ACCOUNT_MANAGER",
      role: systemRole || "ACCOUNT_MANAGER",
      department: department || null,
      isActive: isActive !== undefined ? isActive : true,
      allowedModules: allowedModules ? JSON.stringify(allowedModules) : JSON.stringify([]),
    };

    const [row] = await db.insert(usersTable).values(insertData).returning({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      systemRole: usersTable.systemRole,
      department: usersTable.department,
      isActive: usersTable.isActive,
      allowedModules: usersTable.allowedModules,
    });
    return res.status(201).json({
      ...row,
      allowedModules: row.allowedModules ? JSON.parse(row.allowedModules) : [],
    });
  } catch (err) {
    console.error("Create user error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const updateData = {
      ...req.body,
    };
    if (req.body.systemRole) {
      updateData.role = req.body.systemRole;
    }
    if (req.body.allowedModules) {
      updateData.allowedModules = JSON.stringify(req.body.allowedModules);
    }
    const [row] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, req.params.id)).returning({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      systemRole: usersTable.systemRole,
      department: usersTable.department,
      isActive: usersTable.isActive,
      allowedModules: usersTable.allowedModules,
    });
    return res.json({
      ...row,
      allowedModules: row.allowedModules ? JSON.parse(row.allowedModules) : [],
    });
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await db.delete(usersTable).where(eq(usersTable.id, req.params.id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;
