import { NextResponse } from "next/server";

import { prisma } from "@repo/db";
import { PushSharedGoalSchema, CheckinSessionSchema } from "@repo/validators";

import { authorize } from "@/lib/server-auth";
import { getOpenQuarters } from "@/lib/quarter";

function segmentsFromRequest(request: Request) {
  return new URL(request.url).pathname.split("/").filter(Boolean).slice(2);
}

export async function GET(request: Request) {
  const segments = segmentsFromRequest(request);
  const auth = await authorize(request, ["MANAGER", "ADMIN"]);
  if ("response" in auth) return auth.response;

  if (segments[0] === "team") {
    const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true } });
    const teamMembers = await prisma.user.findMany({
      where: { managerId: auth.user.id, role: "EMPLOYEE" },
      select: {
        id: true,
        name: true,
        email: true,
        department: { select: { name: true } },
        goalSheets: activeCycle
          ? {
              where: { cycleId: activeCycle.id },
              select: {
                id: true,
                status: true,
                updatedAt: true,
                goals: { select: { id: true, weightage: true } },
              },
            }
          : false,
      },
      orderBy: { name: "asc" },
    });

    const result = teamMembers.map((member) => {
      const sheet = (member.goalSheets as unknown as Array<any>)[0] ?? null;
      return {
        id: member.id,
        name: member.name,
        email: member.email,
        department: member.department?.name ?? null,
        sheet: sheet
          ? {
              id: sheet.id,
              status: sheet.status,
              updatedAt: sheet.updatedAt,
              goalCount: sheet.goals.length,
              totalWeightage: sheet.goals.reduce((sum: number, goal: { weightage: number }) => sum + goal.weightage, 0),
            }
          : null,
      };
    });

    return NextResponse.json({ cycle: activeCycle ?? null, team: result });
  }

  if (segments[0] === "approvals") {
    const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true } });
    if (!activeCycle) return NextResponse.json([]);

    const sheets = await prisma.goalSheet.findMany({
      where: {
        cycleId: activeCycle.id,
        status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
        user: { managerId: auth.user.id },
      },
      include: {
        user: { select: { id: true, name: true, email: true, department: { select: { name: true } } } },
        goals: { select: { id: true, weightage: true, title: true } },
      },
      orderBy: { updatedAt: "asc" },
    });

    return NextResponse.json(sheets);
  }

  if (segments[0] === "review" && segments[1]) {
    const sheet = await prisma.goalSheet.findUnique({
      where: { id: segments[1] },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: { select: { name: true } },
            manager: { select: { id: true, name: true } },
          },
        },
        goals: {
          include: { thrustArea: true, quarterlyUpdates: true },
          orderBy: { sortOrder: "asc" },
        },
        cycle: { select: { id: true, name: true, year: true } },
      },
    });

    if (!sheet) return NextResponse.json({ error: "Goal sheet not found" }, { status: 404 });
    if (sheet.user.manager?.id !== auth.user.id && auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(sheet);
  }

  if (segments[0] === "checkin-status") {
    const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
    if (!cycle) return NextResponse.json({ cycle: null, grid: [] });

    const openQuarters = await getOpenQuarters();
    const teamMembers = await prisma.user.findMany({
      where: { managerId: auth.user.id, role: "EMPLOYEE" },
      select: {
        id: true,
        name: true,
        email: true,
        goalSheets: {
          where: { cycleId: cycle.id },
          select: {
            id: true,
            status: true,
            checkinSessions: { select: { quarter: true, completedAt: true } },
            goals: {
              select: {
                id: true,
                quarterlyUpdates: { select: { quarter: true, status: true, computedScore: true } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const grid = teamMembers.map((member) => {
      const sheet = (member.goalSheets as unknown as Array<any>)[0] ?? null;
      const checkinMap: Record<string, boolean> = {};
      const scoreMap: Record<string, number | null> = {};

      if (sheet) {
        for (const quarter of openQuarters) {
          const done = sheet.checkinSessions.some((session: { quarter: string }) => session.quarter === quarter);
          checkinMap[quarter] = done;
          const scores = sheet.goals
            .flatMap((goal: { quarterlyUpdates: { quarter: string; computedScore: number | null }[] }) =>
              goal.quarterlyUpdates.filter((update) => update.quarter === quarter && update.computedScore !== null)
            )
            .map((update: { computedScore: number }) => update.computedScore);
          scoreMap[quarter] = scores.length
            ? Math.round((scores.reduce((sum: number, value: number) => sum + value, 0) / scores.length) * 100)
            : null;
        }
      }

      return {
        memberId: member.id,
        name: member.name,
        email: member.email,
        sheetStatus: sheet?.status ?? null,
        sheetId: sheet?.id ?? null,
        checkins: checkinMap,
        avgScores: scoreMap,
      };
    });

    return NextResponse.json({ cycle: { id: cycle.id, name: cycle.name }, openQuarters, grid });
  }

  if (segments[0] === "checkins" && segments[1]) {
    const quarter = segments[1].toUpperCase();
    if (!["Q1", "Q2", "Q3", "Q4"].includes(quarter)) {
      return NextResponse.json({ error: "Invalid quarter" }, { status: 400 });
    }

    const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
    if (!cycle) return NextResponse.json([]);

    const sheets = await prisma.goalSheet.findMany({
      where: {
        cycleId: cycle.id,
        status: "APPROVED",
        user: { managerId: auth.user.id },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        goals: {
          include: {
            thrustArea: { select: { name: true } },
            quarterlyUpdates: { where: { quarter: quarter as any } },
          },
          orderBy: { sortOrder: "asc" },
        },
        checkinSessions: { where: { quarter: quarter as any } },
      },
      orderBy: { user: { name: "asc" } },
    });

    return NextResponse.json(sheets);
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: Request) {
  const segments = segmentsFromRequest(request);
  const auth = await authorize(request, ["MANAGER", "ADMIN"]);
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => ({}));

  if (segments[0] === "shared-goals") {
    const parsed = PushSharedGoalSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { title, description, thrustAreaId, uomType, targetValue, targetDate, recipientUserIds, defaultWeightage } = parsed.data;
    const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true } });
    if (!activeCycle) return NextResponse.json({ error: "No active cycle found" }, { status: 400 });

    const results: { id: string }[] = [];
    await prisma.$transaction(async (tx) => {
      for (const userId of recipientUserIds) {
        const sheet = await tx.goalSheet.upsert({
          where: { userId_cycleId: { userId, cycleId: activeCycle.id } },
          create: { userId, cycleId: activeCycle.id, status: "DRAFT" },
          update: {},
        });

        const existing = await tx.goal.findFirst({ where: { sheetId: sheet.id, isShared: true, title } });
        if (existing) {
          results.push(existing);
          continue;
        }

        const goal = await tx.goal.create({
          data: {
            sheetId: sheet.id,
            title,
            description,
            thrustAreaId,
            uomType,
            targetValue,
            targetDate,
            weightage: defaultWeightage ?? 10,
            isShared: true,
          },
        });
        results.push(goal);
      }
    });

    await prisma.notification.createMany({
      data: recipientUserIds.map((userId) => ({
        userId,
        type: "SHARED_GOAL_RECEIVED" as const,
        title: "New Shared Goal Added",
        message: `Your manager has added a shared goal: "${title}"`,
        link: "/dashboard/goals",
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ pushed: results.length });
  }

  if (segments[0] === "checkin") {
    const parsed = CheckinSessionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const sheet = await prisma.goalSheet.findUnique({
      where: { id: parsed.data.sheetId },
      include: { user: { select: { managerId: true } } },
    });
    if (!sheet || (sheet.user.managerId !== auth.user.id && auth.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (sheet.status !== "APPROVED") {
      return NextResponse.json({ error: "Check-ins are only allowed on approved goal sheets" }, { status: 409 });
    }

    const checkin = await prisma.checkinSession.upsert({
      where: { sheetId_quarter: { sheetId: parsed.data.sheetId, quarter: parsed.data.quarter } },
      create: {
        sheetId: parsed.data.sheetId,
        quarter: parsed.data.quarter,
        managerId: auth.user.id,
        comment: parsed.data.comment,
      },
      update: {
        comment: parsed.data.comment,
        managerId: auth.user.id,
        completedAt: new Date(),
      },
    });

    return NextResponse.json(checkin);
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
