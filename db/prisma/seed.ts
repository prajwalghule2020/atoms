import "dotenv/config";
import { PrismaClient, Role, UomType } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

// Supabase admin client to create auth users
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

async function createAuthUser(email: string, password: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error && error.message !== "User already registered") {
    throw new Error(`Failed to create auth user ${email}: ${error.message}`);
  }
  return data.user?.id ?? email;
}

async function main() {
  console.log("🌱 Seeding database...");

  // ── Create Departments ───────────────────────────────────────────────
  const engineering = await prisma.department.upsert({
    where: { id: "dept-engineering" },
    update: {},
    create: { id: "dept-engineering", name: "Engineering" },
  });

  const sales = await prisma.department.upsert({
    where: { id: "dept-sales" },
    update: {},
    create: { id: "dept-sales", name: "Sales", parentId: null },
  });

  console.log("✅ Departments created");

  // ── Create Auth Users in Supabase ────────────────────────────────────
  const adminAuthId = await createAuthUser("admin@demo.com", "Admin@123");
  const managerAuthId = await createAuthUser("manager@demo.com", "Manager@123");
  const employeeAuthId = await createAuthUser(
    "employee@demo.com",
    "Employee@123"
  );

  console.log("✅ Supabase auth users created");

  // ── Create DB Users ──────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      id: adminAuthId,
      email: "admin@demo.com",
      name: "Admin User",
      role: Role.ADMIN,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@demo.com" },
    update: {},
    create: {
      id: managerAuthId,
      email: "manager@demo.com",
      name: "Sarah Johnson",
      role: Role.MANAGER,
      departmentId: engineering.id,
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: "employee@demo.com" },
    update: {},
    create: {
      id: employeeAuthId,
      email: "employee@demo.com",
      name: "Alex Kumar",
      role: Role.EMPLOYEE,
      managerId: manager.id,
      departmentId: engineering.id,
    },
  });

  console.log("✅ Users created:", { admin: admin.name, manager: manager.name, employee: employee.name });

  // ── Create Active Cycle ──────────────────────────────────────────────
  const cycle = await prisma.cycle.upsert({
    where: { id: "cycle-2025" },
    update: { isActive: true },
    create: {
      id: "cycle-2025",
      year: 2025,
      name: "FY 2025-26",
      goalSettingOpen: new Date("2025-05-01"),
      q1Open: new Date("2025-07-01"),
      q2Open: new Date("2025-10-01"),
      q3Open: new Date("2026-01-01"),
      q4Open: new Date("2026-03-01"),
      isActive: true,
    },
  });

  console.log("✅ Cycle created:", cycle.name);

  // ── Create Thrust Areas ──────────────────────────────────────────────
  const thrustAreas = await Promise.all([
    prisma.thrustArea.upsert({
      where: { id: "ta-revenue" },
      update: {},
      create: { id: "ta-revenue", name: "Revenue Growth", cycleId: cycle.id },
    }),
    prisma.thrustArea.upsert({
      where: { id: "ta-ops" },
      update: {},
      create: { id: "ta-ops", name: "Operational Excellence", cycleId: cycle.id },
    }),
    prisma.thrustArea.upsert({
      where: { id: "ta-people" },
      update: {},
      create: { id: "ta-people", name: "People Development", cycleId: cycle.id },
    }),
    prisma.thrustArea.upsert({
      where: { id: "ta-safety" },
      update: {},
      create: { id: "ta-safety", name: "Safety & Compliance", cycleId: cycle.id },
    }),
  ]);

  console.log("✅ Thrust areas created:", thrustAreas.map((t) => t.name));

  // ── Demo Goal Sheet for Employee ─────────────────────────────────────
  const sheet = await prisma.goalSheet.upsert({
    where: { userId_cycleId: { userId: employee.id, cycleId: cycle.id } },
    update: {},
    create: {
      userId: employee.id,
      cycleId: cycle.id,
      status: "DRAFT",
    },
  });

  // Add sample goals (total weightage = 100%)
  const sampleGoals = [
    {
      title: "Increase feature delivery velocity by 20%",
      thrustAreaId: "ta-ops",
      uomType: UomType.NUMERIC_MIN,
      targetValue: 20,
      weightage: 30,
    },
    {
      title: "Achieve team code review turnaround < 24 hours",
      thrustAreaId: "ta-ops",
      uomType: UomType.NUMERIC_MAX,
      targetValue: 24,
      weightage: 20,
    },
    {
      title: "Complete AWS Solutions Architect certification",
      thrustAreaId: "ta-people",
      uomType: UomType.TIMELINE,
      targetDate: new Date("2025-12-31"),
      weightage: 20,
    },
    {
      title: "Zero critical security incidents",
      thrustAreaId: "ta-safety",
      uomType: UomType.ZERO,
      targetValue: 0,
      weightage: 30,
    },
  ];

  for (let i = 0; i < sampleGoals.length; i++) {
    const g = sampleGoals[i]!;
    await prisma.goal.upsert({
      where: { id: `goal-demo-${i}` },
      update: {},
      create: {
        id: `goal-demo-${i}`,
        sheetId: sheet.id,
        title: g.title,
        thrustAreaId: g.thrustAreaId,
        uomType: g.uomType,
        targetValue: g.targetValue,
        targetDate: g.targetDate,
        weightage: g.weightage,
        sortOrder: i,
      },
    });
  }

  console.log("✅ Sample goal sheet + goals created for employee");
  console.log("\n🎉 Seed complete!");
  console.log("   admin@demo.com    / Admin@123    → ADMIN");
  console.log("   manager@demo.com  / Manager@123  → MANAGER");
  console.log("   employee@demo.com / Employee@123 → EMPLOYEE");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
