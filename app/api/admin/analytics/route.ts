import { NextResponse } from "next/server";
import { authorize } from "@/lib/server-auth";
import { prisma } from "@repo/db";

export async function GET(request: Request) {
  const result = await authorize(request);
  if ("response" in result) return result.response;

  if (result.user.role !== "ADMIN" && result.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const cycle = await prisma.cycle.findFirst({
      where: { isActive: true },
    });

    if (!cycle) {
      return NextResponse.json({ error: "No active cycle" }, { status: 400 });
    }

    // 1. Goal Distribution by Thrust Area
    const thrustAreas = await prisma.thrustArea.findMany({
      where: { cycleId: cycle.id },
      include: { _count: { select: { goals: true } } }
    });
    const goalDistribution = thrustAreas.map(ta => ({
      name: ta.name,
      value: ta._count.goals
    })).filter(ta => ta.value > 0);

    // 2. Goal Sheet Status Distribution
    const sheetStatuses = await prisma.goalSheet.groupBy({
      by: ['status'],
      where: { cycleId: cycle.id },
      _count: { id: true }
    });
    const sheetStatusDistribution = sheetStatuses.map(s => ({
      name: s.status,
      value: s._count.id
    }));

    // 3. Quarterly Updates Completion (across all goals in cycle)
    const quarterlyUpdates = await prisma.quarterlyUpdate.groupBy({
      by: ['status', 'quarter'],
      where: { goal: { sheet: { cycleId: cycle.id } } },
      _count: { id: true }
    });

    const VALID_STATUSES = ["COMPLETED", "ON_TRACK", "NOT_STARTED"] as const;
    type QuarterStat = { name: string; COMPLETED: number; ON_TRACK: number; NOT_STARTED: number };
    const checkinStats: Record<string, QuarterStat> = {
      Q1: { name: 'Q1', COMPLETED: 0, ON_TRACK: 0, NOT_STARTED: 0 },
      Q2: { name: 'Q2', COMPLETED: 0, ON_TRACK: 0, NOT_STARTED: 0 },
      Q3: { name: 'Q3', COMPLETED: 0, ON_TRACK: 0, NOT_STARTED: 0 },
      Q4: { name: 'Q4', COMPLETED: 0, ON_TRACK: 0, NOT_STARTED: 0 },
    };

    quarterlyUpdates.forEach(update => {
      const q = checkinStats[update.quarter];
      if (!q) return;
      if ((VALID_STATUSES as readonly string[]).includes(update.status)) {
        q[update.status as typeof VALID_STATUSES[number]] += update._count.id;
      }
    });

    return NextResponse.json({
      goalDistribution,
      sheetStatusDistribution,
      checkinStats: Object.values(checkinStats),
    });
  } catch (err) {
    console.error("Analytics error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
