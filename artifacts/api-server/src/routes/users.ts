import { Router } from "express";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { createId } from "@paralleldrive/cuid2";
import bcrypt from "bcrypt";

const router = Router();

router.get("/users", requireAuth, async (_req, res) => {
  try {
    const allUsers = await db.select().from(users).orderBy(sql`name asc`);
    res.json(allUsers.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      department: u.department,
      avatarUrl: u.avatarUrl,
      systemRole: u.systemRole,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users", requireAuth, async (req, res) => {
  try {
    const data = req.body;
    const passwordHash = await bcrypt.hash(data.password ?? "Password@123", 10);
    const [user] = await db.insert(users).values({
      id: createId(),
      email: data.email.toLowerCase().trim(),
      passwordHash,
      name: data.name,
      phone: data.phone ?? null,
      department: data.department ?? null,
      systemRole: data.systemRole ?? "DEVELOPER",
      isActive: true,
    }).returning();
    res.status(201).json({ id: user.id, email: user.email, name: user.name, phone: user.phone, department: user.department, avatarUrl: user.avatarUrl, systemRole: user.systemRole, isActive: user.isActive, createdAt: user.createdAt.toISOString() });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "Email already exists" });
    } else {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

router.get("/users/:id", requireAuth, async (req, res) => {
  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, req.params.id as string) });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ id: user.id, email: user.email, name: user.name, phone: user.phone, department: user.department, avatarUrl: user.avatarUrl, systemRole: user.systemRole, isActive: user.isActive, createdAt: user.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:id", requireAuth, async (req, res) => {
  try {
    const updateData: any = { ...req.body, updatedAt: new Date() };
    delete updateData.password;
    if (req.body.password) {
      updateData.passwordHash = await bcrypt.hash(req.body.password, 10);
    }
    const [updated] = await db.update(users).set(updateData).where(eq(users.id, req.params.id as string)).returning();
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ id: updated.id, email: updated.email, name: updated.name, phone: updated.phone, department: updated.department, avatarUrl: updated.avatarUrl, systemRole: updated.systemRole, isActive: updated.isActive, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(users).where(eq(users.id, req.params.id as string));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
