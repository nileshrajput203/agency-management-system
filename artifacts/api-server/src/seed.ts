import { db, usersTable, agencySettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "admin@agencyps.com"))
    .limit(1);

  if (!existing) {
    const passwordHash = await bcrypt.hash("Admin@123", 10);
    await db.insert(usersTable).values({
      id: crypto.randomUUID(),
      email: "admin@agencyps.com",
      password: passwordHash,
      name: "Super Admin",
      role: "SUPER_ADMIN",
      systemRole: "SUPER_ADMIN",
      isActive: true,
    });
    console.log("✓ Admin user created: admin@agencyps.com / Admin@123");
  } else {
    console.log("✓ Admin user already exists");
  }

  const [settings] = await db
    .select()
    .from(agencySettingsTable)
    .where(eq(agencySettingsTable.id, "default"))
    .limit(1);

  if (!settings) {
    await db.insert(agencySettingsTable).values({
      id: "default",
      agencyName: "Blink Beyond",
      primaryColor: "#6366f1",
      currency: "INR",
      taxLabel: "GST",
      taxPercent: 18,
      workDayStart: "09:00",
      workDayEnd: "18:00",
    });
    console.log("✓ Agency settings created");
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
