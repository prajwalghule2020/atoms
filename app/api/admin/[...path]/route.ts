import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { prisma } from "@repo/db";
import {
  CreateCycleSchema,
  UpdateCycleSchema,
  CreateUserSchema,
  UpdateUserSchema,
  CreateDepartmentSchema,
  UnlockSheetSchema,
  CreateEscalationRuleSchema,
} from "@repo/validators";

import { authorize } from "@/lib/server-auth";

function segmentsFromRequest(request: Request) {
  return new URL(request.url).pathname.split("/").filter(Boolean).slice(2);
}

export async function GET(request: Request) {
  const segments = segmentsFromRequest(request);
  const auth = await authorize(request, ["ADMIN"]);
  if ("response" in auth) return auth.response;
  const searchParams = new URL(request.url).searchParams;

  if (segments[0] === "cycles") {
    const cycles = await prisma.cycle.findMany({
      include: { _count: { select: { goalSheets: true, thrustAreas: true } } },
      orderBy: { year: "desc" },
    });
    return NextResponse.json(cycles);
  }

  if (segments[0] === "users") {
    const role = searchParams.get("role") ?? undefined;
    const departmentId = searchParams.get("departmentId") ?? undefined;
    const managerId = searchParams.get("managerId") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role: role as any } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(managerId ? { managerId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        _count: { select: { goalSheets: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(users);
  }

  if (segments[0] === "departments") {
    const departments = await prisma.department.findMany({
      include: { parent: { select: { id: true, name: true } }, _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(departments);
  }

  if (segments[0] === "reports" && segments[1] === "achievement") {
    const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
    if (!cycle) return NextResponse.json({ cycle: null, summary: null, departments: [] });

    const sheets = await prisma.goalSheet.findMany({
      where: { cycleId: cycle.id },
      select: {
        id: true,
        status: true,
        userId: true,
        user: { select: { departmentId: true, department: { select: { name: true } } } },
        goals: { select: { weightage: true, quarterlyUpdates: { select: { computedScore: true, quarter: true } } } },
      },
    });

    const total = sheets.length;
    const submitted = sheets.filter((sheet: any) => sheet.status !== "DRAFT").length;
    const approved = sheets.filter((sheet: any) => sheet.status === "APPROVED").length;

    const deptMap: Record<string, { name: string; count: number; approved: number; totalScore: number; scoredGoals: number }> = {};
    for (const sheet of sheets) {
      const deptId = sheet.user.departmentId ?? "__none__";
      const deptName = sheet.user.department?.name ?? "No Department";
      if (!deptMap[deptId]) deptMap[deptId] = { name: deptName, count: 0, approved: 0, totalScore: 0, scoredGoals: 0 };
      deptMap[deptId].count++;
      if (sheet.status === "APPROVED") deptMap[deptId].approved++;

      for (const goal of sheet.goals) {
        for (const update of goal.quarterlyUpdates) {
          if (update.computedScore !== null) {
            deptMap[deptId].totalScore += update.computedScore * goal.weightage;
            deptMap[deptId].scoredGoals++;
          }
        }
      }
    }

    const departments = Object.values(deptMap).map((dept) => ({
      name: dept.name,
      totalEmployees: dept.count,
      approvedSheets: dept.approved,
      avgScore: dept.scoredGoals > 0 ? Math.round((dept.totalScore / dept.scoredGoals) * 100) : null,
    }));

    return NextResponse.json({
      cycle: { id: cycle.id, name: cycle.name, year: cycle.year },
      summary: { total, submitted, approved, completionPct: total > 0 ? Math.round((approved / total) * 100) : 0 },
      departments,
    });
  }

  if (segments[0] === "reports" && segments[1] === "completion") {
    const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
    if (!cycle) return NextResponse.json({ cycle: null, notSubmitted: [] });

    const usersWithDraft = await prisma.user.findMany({
      where: {
        role: "EMPLOYEE",
        OR: [
          { goalSheets: { none: { cycleId: cycle.id } } },
          { goalSheets: { some: { cycleId: cycle.id, status: "DRAFT" } } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        department: { select: { name: true } },
        manager: { select: { name: true } },
        goalSheets: { where: { cycleId: cycle.id }, select: { status: true, updatedAt: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      cycle: { id: cycle.id, name: cycle.name },
      notSubmitted: usersWithDraft.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department?.name ?? null,
        manager: user.manager?.name ?? null,
        sheetStatus: (user.goalSheets as any[])[0]?.status ?? null,
        lastActivity: (user.goalSheets as any[])[0]?.updatedAt ?? null,
      })),
    });
  }

  if (segments[0] === "reports" && segments[1] === "export") {
    const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
    if (!cycle) return NextResponse.json({ error: "No active cycle found" }, { status: 404 });

    const sheets = await prisma.goalSheet.findMany({
      where: { cycleId: cycle.id },
      include: { user: { include: { department: true, manager: true } }, goals: { include: { thrustArea: true, quarterlyUpdates: true } } },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Atoms Performance Portal";

    const summarySheet = workbook.addWorksheet("Employee Summary");
    summarySheet.columns = [
      { header: "Employee Name", key: "name", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Department", key: "department", width: 20 },
      { header: "Manager", key: "manager", width: 25 },
      { header: "Status", key: "status", width: 15 },
      { header: "Total Goals", key: "goals", width: 15 },
      { header: "Overall Score (%)", key: "score", width: 20 },
    ];

    const goalsSheet = workbook.addWorksheet("Goals Detail");
    goalsSheet.columns = [
      { header: "Employee", key: "emp", width: 25 },
      { header: "Department", key: "dept", width: 20 },
      { header: "Goal Title", key: "title", width: 40 },
      { header: "Thrust Area", key: "thrust", width: 20 },
      { header: "Weightage (%)", key: "weight", width: 15 },
      { header: "Target", key: "target", width: 15 },
      { header: "Q1 Score", key: "q1", width: 10 },
      { header: "Q2 Score", key: "q2", width: 10 },
      { header: "Q3 Score", key: "q3", width: 10 },
      { header: "Q4 Score", key: "q4", width: 10 },
    ];

    summarySheet.getRow(1).font = { bold: true };
    goalsSheet.getRow(1).font = { bold: true };

    for (const sheet of sheets) {
      let totalWeightedScore = 0;
      let totalScoredWeight = 0;

      for (const goal of sheet.goals) {
        let avgScore = 0;
        let qCount = 0;
        const qScores: Record<string, number | null> = { Q1: null, Q2: null, Q3: null, Q4: null };

        for (const update of goal.quarterlyUpdates) {
          if (update.computedScore !== null) {
            avgScore += update.computedScore;
            qCount++;
            qScores[update.quarter] = update.computedScore;
          }
        }

        const finalGoalScore = qCount > 0 ? avgScore / qCount : 0;
        if (qCount > 0) {
          totalWeightedScore += finalGoalScore * goal.weightage;
          totalScoredWeight += goal.weightage;
        }

        goalsSheet.addRow({
          emp: sheet.user.name,
          dept: sheet.user.department?.name ?? "-",
          title: goal.title,
          thrust: goal.thrustArea?.name ?? "-",
          weight: goal.weightage,
          target: `${goal.targetValue} ${goal.uomType}`,
          q1: qScores["Q1"] ?? "-",
          q2: qScores["Q2"] ?? "-",
          q3: qScores["Q3"] ?? "-",
          q4: qScores["Q4"] ?? "-",
        });
      }

      summarySheet.addRow({
        name: sheet.user.name,
        email: sheet.user.email,
        department: sheet.user.department?.name ?? "-",
        manager: sheet.user.manager?.name ?? "-",
        status: sheet.status,
        goals: sheet.goals.length,
        score: totalScoredWeight > 0 ? Math.round(totalWeightedScore / totalScoredWeight) : 0,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Performance_Report_${cycle.year}.xlsx"`,
      },
    });
  }

  if (segments[0] === "audit-logs") {
    const entity = searchParams.get("entity") ?? undefined;
    const userId = searchParams.get("userId") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const page = searchParams.get("page") ?? "1";
    const limit = searchParams.get("limit") ?? "50";
    const pageNum = Math.max(1, parseInt(page));
    const take = Math.min(100, parseInt(limit));

    const where = {
      ...(entity ? { entity } : {}),
      ...(userId ? { changedById: userId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: { changedBy: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * take,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page: pageNum, pages: Math.ceil(total / take) });
  }

  if (segments[0] === "escalation-rules") {
    const rules = await prisma.escalationRule.findMany({
      include: { cycle: { select: { id: true, name: true, year: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(rules);
  }

  if (segments[0] === "notifications") {
    const notifications = await prisma.notification.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json(notifications);
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: Request) {
  const segments = segmentsFromRequest(request);
  const auth = await authorize(request, ["ADMIN"]);
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => ({}));

  if (segments[0] === "cycles") {
    const parsed = CreateCycleSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    if (parsed.data.isActive) {
      await prisma.cycle.updateMany({ where: { isActive: true }, data: { isActive: false } });
    }
    const cycle = await prisma.cycle.create({ data: parsed.data });
    return NextResponse.json(cycle, { status: 201 });
  }

  if (segments[0] === "users") {
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { password: _password, ...data } = parsed.data;
    try {
      const user = await prisma.user.create({ data });
      return NextResponse.json(user, { status: 201 });
    } catch (error: any) {
      if (error?.code === "P2002") {
        return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }
  }

  if (segments[0] === "departments") {
    const parsed = CreateDepartmentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const dept = await prisma.department.create({ data: parsed.data });
    return NextResponse.json(dept, { status: 201 });
  }

  if (segments[0] === "goals" && segments[2] === "unlock" && segments[1]) {
    const sheetId = segments[1];
    const parsed = UnlockSheetSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const sheet = await prisma.goalSheet.findUnique({ where: { id: sheetId } });
    if (!sheet) return NextResponse.json({ error: "Goal sheet not found" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.goalSheet.update({
        where: { id: sheetId },
        data: { status: "DRAFT", lockedAt: null, reworkComment: null },
      });
      await tx.auditLog.create({
        data: {
          entity: "GoalSheet",
          entityId: sheetId,
          changedById: auth.user.id,
          action: "UNLOCK",
          oldData: { status: sheet.status },
          newData: { status: "DRAFT", reason: parsed.data.reason },
        },
      });
      return s;
    });
    return NextResponse.json(updated);
  }

  if (segments[0] === "escalation-rules") {
    const parsed = CreateEscalationRuleSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const rule = await prisma.escalationRule.create({ data: parsed.data });
    return NextResponse.json(rule, { status: 201 });
  }

  if (segments[0] === "notifications" && segments[1] === "mark-read") {
    await prisma.notification.updateMany({ where: { userId: auth.user.id, isRead: false }, data: { isRead: true } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(request: Request) {
  const segments = segmentsFromRequest(request);
  const auth = await authorize(request, ["ADMIN"]);
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => ({}));

  if (segments[0] === "cycles" && segments[1]) {
    const parsed = UpdateCycleSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    if (parsed.data.isActive) {
      await prisma.cycle.updateMany({ where: { isActive: true }, data: { isActive: false } });
    }
    try {
      const cycle = await prisma.cycle.update({ where: { id: segments[1] }, data: parsed.data });
      return NextResponse.json(cycle);
    } catch {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }
  }

  if (segments[0] === "users" && segments[1]) {
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    try {
      const user = await prisma.user.update({ where: { id: segments[1] }, data: parsed.data });
      await prisma.auditLog.create({
        data: { entity: "User", entityId: segments[1], changedById: auth.user.id, action: "UPDATE", newData: parsed.data },
      });
      return NextResponse.json(user);
    } catch {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(request: Request) {
  const segments = segmentsFromRequest(request);
  const auth = await authorize(request, ["ADMIN"]);
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => ({}));

  if (segments[0] === "escalation-rules" && segments[1]) {
    try {
      const rule = await prisma.escalationRule.update({ where: { id: segments[1] }, data: { active: body.active } });
      return NextResponse.json(rule);
    } catch {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
