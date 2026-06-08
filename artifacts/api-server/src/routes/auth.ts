import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "@workspace/db";
import { users, sessions } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { signToken, requireAuth } from "../lib/auth";
import { createId } from "@paralleldrive/cuid2";

const router = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase().trim()),
    });

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Account is disabled" });
      return;
    }

    const token = signToken(user.id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(sessions).values({
      id: createId(),
      userId: user.id,
      token,
      expiresAt,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        systemRole: user.systemRole,
        isActive: user.isActive,
        phone: user.phone,
        department: user.department,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", requireAuth, async (req, res) => {
  try {
    const token = req.headers.authorization?.slice(7) ?? "";
    await db.delete(sessions).where(eq(sessions.token, token));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user!.id),
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      systemRole: user.systemRole,
      isActive: user.isActive,
      phone: user.phone,
      department: user.department,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
