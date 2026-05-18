import { NextResponse } from "next/server";

import { prisma } from "@repo/db";
import {
  CreateGoalSchema,
  UpdateGoalSchema,
  QuarterlyUpdateSchema,
  ReturnSheetSchema,
  validateGoalWeightage,
  computeScore,
} from "@repo/validators";

import { authorize } from "@/lib/server-auth";
import { getOpenQuarters } from "@/lib/quarter";
import { sendGoalSubmittedEmail, sendGoalApprovedEmail, sendGoalReturnedEmail } from "@/lib/email";
import { teamsGoalSubmitted, teamsGoalApproved, teamsGoalReturned } from "@/lib/teams";

function segmentsFromRequest(request: Request) {
  return new URL(request.url).pathname.split("/").filter(Boolean).slice(2);
}

export async function GET(request: Request) {
  const segments = segmentsFromRequest(request);
  const result = await authorize(request);
  if ("response" in result) return result.response;

  if (segments[0] === "thrust-areas" && segments[1]) {
    const thrustAreas = await prisma.thrustArea.findMany({
      where: { cycleId: segments[1] },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(thrustAreas);
  }

  if (segments[0] === "active-cycle") {
    const cycle = await prisma.cycle.findFirst({
      where: { isActive: true },
      include: { thrustAreas: { orderBy: { name: "asc" } } },
    });
    return NextResponse.json(cycle ?? null);
  }

  if (segments[0] === "sheet" && segments[1]) {
    const sheet = await prisma.goalSheet.findUnique({
      where: {
        userId_cycleId: { userId: result.user.id, cycleId: segments[1] },
      },
      include: {
        goals: {
          include: { thrustArea: true, quarterlyUpdates: true },
          orderBy: { sortOrder: "asc" },
        },
        cycle: { select: { id: true, name: true, year: true, isActive: true } },
      },
    });
    return NextResponse.json(sheet ?? null);
  }

  if (segments[0] === "checkins") {
    const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
    if (!cycle) {
      return NextResponse.json({ sheet: null, openQuarters: [], cycle: null });
    }

    const openQuarters = await getOpenQuarters();
    const sheet = await prisma.goalSheet.findUnique({
      where: { userId_cycleId: { userId: result.user.id, cycleId: cycle.id } },
      include: {
        goals: {
          include: {
            thrustArea: { select: { name: true } },
            quarterlyUpdates: { orderBy: { quarter: "asc" } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return NextResponse.json({
      cycle: { id: cycle.id, name: cycle.name, year: cycle.year },
      sheet: sheet ?? null,
      openQuarters,
    });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: Request) {
  const segments = segmentsFromRequest(request);
  const result = await authorize(request);
  if ("response" in result) return result.response;

  const body = await request.json().catch(() => ({}));

  if (segments[0] === "sheet" && segments.length === 1) {
    const { cycleId } = body as { cycleId?: string };
    if (!cycleId) {
      return NextResponse.json({ error: "cycleId is required" }, { status: 400 });
    }

    const sheet = await prisma.goalSheet.upsert({
      where: { userId_cycleId: { userId: result.user.id, cycleId } },
      create: { userId: result.user.id, cycleId, status: "DRAFT" },
      update: {},
      include: {
        goals: { include: { thrustArea: true }, orderBy: { sortOrder: "asc" } },
        cycle: { select: { id: true, name: true, year: true, isActive: true } },
      },
    });
    return NextResponse.json(sheet);
  }

  if (segments.length === 0) {
    const parsed = CreateGoalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { sheetId, ...goalData } = parsed.data;
    const sheet = await prisma.goalSheet.findUnique({
      where: { id: sheetId },
      include: { goals: { select: { weightage: true } } },
    });

    if (!sheet || sheet.userId !== result.user.id) {
      return NextResponse.json({ error: "Goal sheet not found or access denied" }, { status: 403 });
    }
    if (!["DRAFT", "REWORK"].includes(sheet.status)) {
      return NextResponse.json({ error: "Goal sheet is locked and cannot be modified" }, { status: 409 });
    }
    if (sheet.goals.length >= 8) {
      return NextResponse.json({ error: "Maximum of 8 goals allowed per goal sheet" }, { status: 409 });
    }

    const goal = await prisma.goal.create({
      data: {
        sheetId,
        title: goalData.title,
        description: goalData.description,
        thrustAreaId: goalData.thrustAreaId,
        uomType: goalData.uomType,
        targetValue: goalData.targetValue,
        targetDate: goalData.targetDate,
        weightage: goalData.weightage,
        sortOrder: goalData.sortOrder ?? sheet.goals.length,
      },
      include: { thrustArea: true },
    });
    return NextResponse.json(goal, { status: 201 });
  }

  if (segments[0] === "sheet" && segments[2] === "submit" && segments[1]) {
    const sheetId = segments[1];
    const sheet = await prisma.goalSheet.findUnique({
      where: { id: sheetId },
      include: { goals: true, user: { include: { manager: true } }, cycle: true },
    });

    if (!sheet || sheet.userId !== result.user.id) {
      return NextResponse.json({ error: "Goal sheet not found or access denied" }, { status: 403 });
    }
    if (!["DRAFT", "REWORK"].includes(sheet.status)) {
      return NextResponse.json({ error: "Goal sheet has already been submitted" }, { status: 409 });
    }
    if (sheet.goals.length === 0) {
      return NextResponse.json({ error: "Cannot submit an empty goal sheet" }, { status: 400 });
    }

    const validation = validateGoalWeightage(sheet.goals);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error, total: validation.total }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedSheet = await tx.goalSheet.update({
        where: { id: sheetId },
        data: { status: "SUBMITTED" },
      });

      if (result.user.managerId) {
        await tx.notification.create({
          data: {
            userId: result.user.managerId,
            type: "GOAL_SUBMITTED",
            title: "New Goal Sheet for Review",
            message: `${result.user.name} has submitted their goal sheet for your review.`,
            link: `/manager/review/${sheetId}`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          entity: "GoalSheet",
          entityId: sheetId,
          changedById: result.user.id,
          action: "SUBMIT",
          newData: { status: "SUBMITTED" },
        },
      });

      return updatedSheet;
    });

    if (sheet.user.managerId && sheet.user.manager) {
      await sendGoalSubmittedEmail({
        managerEmail: sheet.user.manager.email,
        managerName: sheet.user.manager.name,
        employeeName: sheet.user.name,
        sheetId: sheet.id,
        cycleName: sheet.cycle.name,
      });
      await teamsGoalSubmitted({
        employeeName: sheet.user.name,
        managerName: sheet.user.manager.name,
        cycleName: sheet.cycle.name,
        sheetId: sheet.id,
      });
    }

    return NextResponse.json(updated);
  }

  if (segments[0] === "sheet" && segments[2] === "return" && segments[1]) {
    const auth = await authorize(request, ["MANAGER", "ADMIN"]);
    if ("response" in auth) return auth.response;
    const sheetId = segments[1];
    const parsed = ReturnSheetSchema.safeParse({ sheetId, ...body });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const sheet = await prisma.goalSheet.findUnique({
      where: { id: sheetId },
      include: { user: { select: { id: true, name: true, email: true, managerId: true } }, cycle: true },
    });
    if (!sheet) return NextResponse.json({ error: "Goal sheet not found" }, { status: 404 });
    if (!["SUBMITTED", "UNDER_REVIEW"].includes(sheet.status)) {
      return NextResponse.json({ error: "Sheet is not in a returnable state" }, { status: 409 });
    }
    if (sheet.user.managerId !== auth.user.id && auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedSheet = await tx.goalSheet.update({
        where: { id: sheetId },
        data: { status: "REWORK", reworkComment: parsed.data.reworkComment },
      });

      await tx.notification.create({
        data: {
          userId: sheet.userId,
          type: "GOAL_RETURNED",
          title: "Goal Sheet Returned for Rework",
          message: `Your manager has returned your goal sheet with feedback. Please revise and resubmit.`,
          link: "/dashboard/goals",
        },
      });

      await tx.auditLog.create({
        data: {
          entity: "GoalSheet",
          entityId: sheetId,
          changedById: auth.user.id,
          action: "RETURN",
          oldData: { status: sheet.status },
          newData: { status: "REWORK", reworkComment: parsed.data.reworkComment },
        },
      });

      return updatedSheet;
    });

    await sendGoalReturnedEmail({
      employeeEmail: sheet.user.email,
      employeeName: sheet.user.name,
      managerName: auth.user.name,
      cycleName: sheet.cycle.name,
      reworkComment: parsed.data.reworkComment,
    });
    await teamsGoalReturned({
      employeeName: sheet.user.name,
      managerName: auth.user.name,
      cycleName: sheet.cycle.name,
      reworkComment: parsed.data.reworkComment,
    });

    return NextResponse.json(updated);
  }

  if (segments[0] === "sheet" && segments[2] === "approve" && segments[1]) {
    const auth = await authorize(request, ["MANAGER", "ADMIN"]);
    if ("response" in auth) return auth.response;
    const sheetId = segments[1];

    const sheet = await prisma.goalSheet.findUnique({
      where: { id: sheetId },
      include: { user: { select: { id: true, name: true, email: true, managerId: true } }, goals: true, cycle: true },
    });
    if (!sheet) return NextResponse.json({ error: "Goal sheet not found" }, { status: 404 });
    if (!["SUBMITTED", "UNDER_REVIEW"].includes(sheet.status)) {
      return NextResponse.json({ error: "Sheet is not in an approvable state" }, { status: 409 });
    }
    if (sheet.user.managerId !== auth.user.id && auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedSheet = await tx.goalSheet.update({
        where: { id: sheetId },
        data: { status: "APPROVED", lockedAt: new Date() },
      });

      await tx.notification.create({
        data: {
          userId: sheet.userId,
          type: "GOAL_APPROVED",
          title: "Goal Sheet Approved! ✅",
          message: "Your goal sheet has been approved by your manager.",
          link: "/dashboard/goals",
        },
      });

      await tx.auditLog.create({
        data: {
          entity: "GoalSheet",
          entityId: sheetId,
          changedById: auth.user.id,
          action: "APPROVE",
          oldData: { status: sheet.status },
          newData: { status: "APPROVED", lockedAt: new Date().toISOString() },
        },
      });

      return updatedSheet;
    });

    await sendGoalApprovedEmail({
      employeeEmail: sheet.user.email,
      employeeName: sheet.user.name,
      managerName: auth.user.name,
      cycleName: sheet.cycle.name,
    });
    await teamsGoalApproved({
      employeeName: sheet.user.name,
      managerName: auth.user.name,
      cycleName: sheet.cycle.name,
    });

    return NextResponse.json(updated);
  }

  if (segments[0] && segments[1] === "update" && segments[2]) {
    const goalId = segments[0];
    const quarter = segments[2];
    const parsed = QuarterlyUpdateSchema.safeParse({ ...body, goalId, quarter });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: { sheet: true },
    });

    if (!goal || goal.sheet.userId !== result.user.id) {
      return NextResponse.json({ error: "Goal not found or access denied" }, { status: 403 });
    }
    if (goal.sheet.status !== "APPROVED") {
      return NextResponse.json({ error: "Quarterly updates are only allowed on approved goal sheets" }, { status: 409 });
    }

    const score = computeScore(
      goal.uomType,
      goal.targetValue,
      parsed.data.actualValue,
      goal.targetDate ?? undefined,
      parsed.data.actualDate
    );

    const update = await prisma.quarterlyUpdate.upsert({
      where: { goalId_quarter: { goalId, quarter: parsed.data.quarter } },
      create: {
        goalId,
        quarter: parsed.data.quarter,
        actualValue: parsed.data.actualValue,
        actualDate: parsed.data.actualDate,
        status: parsed.data.status,
        computedScore: score,
      },
      update: {
        actualValue: parsed.data.actualValue,
        actualDate: parsed.data.actualDate,
        status: parsed.data.status,
        computedScore: score,
      },
    });

    return NextResponse.json({ ...update, computedScore: score });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(request: Request) {
  const segments = segmentsFromRequest(request);
  const result = await authorize(request);
  if ("response" in result) return result.response;

  if (segments.length === 1) {
    const goalId = segments[0];
    const body = await request.json().catch(() => ({}));
    const parsed = UpdateGoalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: { sheet: true },
    });

    if (!goal || goal.sheet.userId !== result.user.id) {
      return NextResponse.json({ error: "Goal not found or access denied" }, { status: 403 });
    }
    if (!["DRAFT", "REWORK"].includes(goal.sheet.status)) {
      return NextResponse.json({ error: "Goal sheet is locked and cannot be modified" }, { status: 409 });
    }
    if (goal.isShared && (parsed.data.title || parsed.data.targetValue !== undefined)) {
      return NextResponse.json({ error: "Title and target of shared goals cannot be edited" }, { status: 409 });
    }

    const updated = await prisma.goal.update({
      where: { id: goalId },
      data: parsed.data,
      include: { thrustArea: true },
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(request: Request) {
  const segments = segmentsFromRequest(request);
  const result = await authorize(request);
  if ("response" in result) return result.response;

  if (segments.length === 1) {
    const goalId = segments[0];
    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: { sheet: true },
    });

    if (!goal || goal.sheet.userId !== result.user.id) {
      return NextResponse.json({ error: "Goal not found or access denied" }, { status: 403 });
    }
    if (!["DRAFT", "REWORK"].includes(goal.sheet.status)) {
      return NextResponse.json({ error: "Goal sheet is locked and cannot be modified" }, { status: 409 });
    }
    if (goal.isShared) {
      return NextResponse.json({ error: "Shared goals cannot be deleted" }, { status: 409 });
    }

    await prisma.goal.delete({ where: { id: goalId } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
