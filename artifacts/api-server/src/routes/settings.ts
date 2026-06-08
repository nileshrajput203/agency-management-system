import { Router } from "express";
import { db } from "@workspace/db";
import { agencySettings } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/settings", requireAuth, async (_req, res) => {
  try {
    let settings = await db.query.agencySettings.findFirst({
      where: eq(agencySettings.id, "default"),
    });

    if (!settings) {
      const [created] = await db.insert(agencySettings).values({
        id: "default",
        agencyName: "Blink Beyond",
        primaryColor: "#6366f1",
        currency: "INR",
        taxLabel: "GST",
        taxPercent: 18,
        workDayStart: "09:00",
        workDayEnd: "18:00",
      }).returning();
      settings = created;
    }

    res.json({ ...settings, updatedAt: settings.updatedAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/settings", requireAuth, async (req, res) => {
  try {
    let settings = await db.query.agencySettings.findFirst({
      where: eq(agencySettings.id, "default"),
    });

    if (!settings) {
      const [created] = await db.insert(agencySettings).values({
        id: "default",
        agencyName: "Blink Beyond",
        primaryColor: "#6366f1",
        currency: "INR",
        taxLabel: "GST",
        taxPercent: 18,
        workDayStart: "09:00",
        workDayEnd: "18:00",
      }).returning();
      settings = created;
    }

    const [updated] = await db.update(agencySettings)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(agencySettings.id, "default"))
      .returning();

    res.json({ ...updated, updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
