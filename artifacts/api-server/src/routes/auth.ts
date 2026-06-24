import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hash, compare } from "bcryptjs";
import { signToken } from "../lib/jwt";

const router = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const valid = await compare(password, user.password || "");
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    // Block inactive users (pending admin approval)
    if (!user.isActive) {
      return res.status(403).json({ error: "Your account is pending admin approval. Please contact your administrator." });
    }
    const token = signToken(user.id);
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        systemRole: user.systemRole,
        allowedModules: user.allowedModules ? JSON.parse(user.allowedModules) : [],
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

router.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Check if email already exists
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await hash(password, 12);
    const [user] = await db.insert(usersTable).values({
      name,
      email,
      password: passwordHash,
      role: "MANAGER",
      systemRole: "ACCOUNT_MANAGER",
      isActive: true, // Auto-approve new registrations
    }).returning({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      systemRole: usersTable.systemRole,
    });

    return res.status(201).json({ message: "Account created successfully. You can now log in.", user });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;


