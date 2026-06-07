import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { scheduleMonth, type DeliverableType } from "../src/lib/content-scheduler";


const url = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 12);

  await prisma.agencySettings.upsert({
    where: { id: "default" },
    create: { id: "default", companyName: "Blink Beyond" },
    update: {},
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@blinkbeyond.com" },
    create: {
      email: "admin@blinkbeyond.com",
      name: "Nilesh — Owner",
      passwordHash,
      systemRole: "SUPER_ADMIN",
      department: "Leadership",
    },
    update: { passwordHash },
  });

  const demoUsers = [
    {
      email: "manager@blinkbeyond.com",
      name: "Priya Sharma",
      systemRole: "MANAGER" as const,
      department: "Operations",
    },
    {
      email: "sales@blinkbeyond.com",
      name: "Rahul Mehta",
      systemRole: "SALES_EXECUTIVE" as const,
      department: "Sales",
    },
    {
      email: "designer@blinkbeyond.com",
      name: "Ananya Patel",
      systemRole: "DESIGNER" as const,
      department: "Creative",
    },
    {
      email: "finance@blinkbeyond.com",
      name: "Vikram Singh",
      systemRole: "FINANCE_EXECUTIVE" as const,
      department: "Finance",
    },
  ];

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: { ...u, passwordHash },
      update: { passwordHash },
    });
  }

  await prisma.leaveBalance.upsert({
    where: { userId: admin.id },
    create: { userId: admin.id },
    update: {},
  });

  const client = await prisma.client.upsert({
    where: { id: "seed-client-1" },
    create: {
      id: "seed-client-1",
      companyName: "Acme Retail Pvt Ltd",
      contactPerson: "Sarah Johnson",
      email: "sarah@acmeretail.com",
      phone: "+91 98765 43210",
      category: "RETAINER",
      source: "Referral",
      health: "GREEN",
    },
    update: {},
  });

  // Seed content contract and deliverables for seed-project-1
  const contract = await prisma.contentContract.upsert({
    where: { id: "seed-contract-1" },
    create: {
      id: "seed-contract-1",
      clientId: client.id,
      durationMonths: 6,
      startMonth: "2025-07",
      reelsPerMonth: 6,
      postsPerMonth: 4,
      carouselsPerMonth: 0,
      blogsPerMonth: 0,
      notes: "Auto-seeded contract for testing",
    },
    update: {},
  });

  const project = await prisma.project.upsert({
    where: { id: "seed-project-1" },
    create: {
      id: "seed-project-1",
      name: "Q2 Social Media Campaign",
      clientId: client.id,
      serviceType: "Social Media Management",
      status: "IN_PROGRESS",
      budget: 150000,
      progress: 35,
      managerId: admin.id,
      contractId: contract.id,
    },
    update: {
      contractId: contract.id,
    },
  });

  // Generate and seed deliverables for this contract
  const deliverableCount = await prisma.contentDeliverable.count({
    where: { contractId: contract.id }
  });

  if (deliverableCount === 0) {
    const counts = [
      { type: "REEL" as const, count: 6 },
      { type: "POST" as const, count: 4 },
    ];
    const deliverableData = [];

    const [startYearStr, startMonthStr] = contract.startMonth.split("-");
    const startYear = parseInt(startYearStr!, 10);
    const startMonthNum = parseInt(startMonthStr!, 10) - 1;

    for (let m = 0; m < contract.durationMonths; m++) {
      const monthDate = new Date(startYear, startMonthNum + m, 1);
      const mStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      
      const schedule = scheduleMonth(mStr, counts);
      
      for (const item of schedule) {
        deliverableData.push({
          contractId: contract.id,
          projectId: project.id,
          type: item.type as DeliverableType,
          month: mStr,
          scheduledDate: item.scheduledDate,
          editStartDate: item.editStartDate,
          editEndDate: item.editEndDate,
          sortOrder: item.sortOrder,
          status: "PENDING" as const,
        });
      }
    }

    if (deliverableData.length > 0) {
      await prisma.contentDeliverable.createMany({
        data: deliverableData,
      });
    }
  }


  const statuses = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
  const taskTitles = [
    "Content strategy deck",
    "Instagram reel batch 1",
    "Carousel designs",
    "Client approval follow-up",
  ];

  for (let i = 0; i < taskTitles.length; i++) {
    await prisma.task.upsert({
      where: { id: `seed-task-${i + 1}` },
      create: {
        id: `seed-task-${i + 1}`,
        projectId: project.id,
        title: taskTitles[i]!,
        status: statuses[i]!,
        priority: i === 3 ? "URGENT" : "MEDIUM",
        sortOrder: i,
        creatorId: admin.id,
      },
      update: {},
    });
  }

  for (const stage of [
    "LEAD",
    "CONTACTED",
    "PROPOSAL_SENT",
    "NEGOTIATION",
  ] as const) {
    await prisma.lead.create({
      data: {
        title: `${stage} — Demo Lead`,
        companyName: "New Prospect Co",
        stage,
        value: 50000 + Math.random() * 100000,
        ownerId: (
          await prisma.user.findUnique({
            where: { email: "sales@blinkbeyond.com" },
          })
        )?.id,
      },
    });
  }

  const catalogCount = await prisma.serviceCatalogItem.count();
  if (catalogCount === 0) {
    await prisma.serviceCatalogItem.createMany({
      data: [
        {
          name: "Website Development",
          basePrice: 75000,
          unit: "project",
        },
        {
          name: "Monthly Social Retainer",
          basePrice: 45000,
          unit: "month",
        },
        {
          name: "Performance Marketing",
          basePrice: 30000,
          unit: "month",
        },
      ],
    });
  }

  const rulesCount = await prisma.automationRule.count();
  if (rulesCount === 0) {
    await prisma.automationRule.createMany({
      data: [
        {
          name: "Proposal approved → Generate contract",
          trigger: "proposal.approved",
          action: "create.agreement",
          isActive: true,
        },
        {
          name: "Content admin approved → Schedule publish",
          trigger: "content.admin_approved",
          action: "schedule.publish",
          isActive: true,
        },
        {
          name: "Invoice overdue 7 days → Send reminder",
          trigger: "invoice.overdue",
          action: "send.email",
          isActive: true,
        },
      ],
    });
  }

  // --- Festive Days ---
  const festiveDays = [
    { name: "Republic Day", date: new Date("2025-01-26T00:00:00Z"), category: "NATIONAL" as const },
    { name: "Holi", date: new Date("2025-03-14T00:00:00Z"), category: "RELIGIOUS" as const },
    { name: "Independence Day", date: new Date("2025-08-15T00:00:00Z"), category: "NATIONAL" as const },
    { name: "Raksha Bandhan", date: new Date("2025-08-09T00:00:00Z"), category: "RELIGIOUS" as const },
    { name: "Gandhi Jayanti", date: new Date("2025-10-02T00:00:00Z"), category: "NATIONAL" as const },
    { name: "Dussehra", date: new Date("2025-10-02T00:00:00Z"), category: "RELIGIOUS" as const },
    { name: "Diwali", date: new Date("2025-10-20T00:00:00Z"), category: "RELIGIOUS" as const },
    { name: "Christmas", date: new Date("2025-12-25T00:00:00Z"), category: "RELIGIOUS" as const },

    { name: "Republic Day", date: new Date("2026-01-26T00:00:00Z"), category: "NATIONAL" as const },
    { name: "Holi", date: new Date("2026-03-03T00:00:00Z"), category: "RELIGIOUS" as const },
    { name: "Independence Day", date: new Date("2026-08-15T00:00:00Z"), category: "NATIONAL" as const },
    { name: "Raksha Bandhan", date: new Date("2026-08-28T00:00:00Z"), category: "RELIGIOUS" as const },
    { name: "Gandhi Jayanti", date: new Date("2026-10-02T00:00:00Z"), category: "NATIONAL" as const },
    { name: "Dussehra", date: new Date("2026-10-20T00:00:00Z"), category: "RELIGIOUS" as const },
    { name: "Diwali", date: new Date("2026-11-08T00:00:00Z"), category: "RELIGIOUS" as const },
    { name: "Christmas", date: new Date("2026-12-25T00:00:00Z"), category: "RELIGIOUS" as const },
  ];

  for (const festival of festiveDays) {
    // Upsert by name and date so we don't duplicate on re-seeds
    const existing = await prisma.festiveDay.findFirst({
      where: { name: festival.name, date: festival.date }
    });
    if (!existing) {
      await prisma.festiveDay.create({
        data: festival
      });
    }
  }

  console.log("✅ Seed complete");
  console.log("   OWNER: admin@blinkbeyond.com / admin123");
  console.log("   Team: manager@, sales@, designer@, finance@blinkbeyond.com / admin123");
  console.log("   Change passwords after first login via Team & Logins");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
