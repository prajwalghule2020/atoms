import { NextResponse } from "next/server";
import { authorize } from "@/lib/server-auth";
import { prisma } from "@repo/db";
import { PushSharedGoalSchema } from "@repo/validators";

export async function POST(request: Request) {
  const result = await authorize(request);
  if ("response" in result) return result.response;
  
  if (result.user.role !== "ADMIN" && result.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized. Admin or Manager role required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = PushSharedGoalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Find the active cycle
  const cycle = await prisma.cycle.findFirst({
    where: { isActive: true },
  });

  if (!cycle) {
    return NextResponse.json({ error: "No active cycle found." }, { status: 400 });
  }

  // Verify the ThrustArea belongs to the active cycle
  const thrustArea = await prisma.thrustArea.findUnique({
    where: { id: data.thrustAreaId },
  });

  if (!thrustArea || thrustArea.cycleId !== cycle.id) {
    return NextResponse.json({ error: "Invalid thrust area for the active cycle." }, { status: 400 });
  }

  let successCount = 0;
  const errors = [];

  for (const userId of data.recipientUserIds) {
    try {
      // Find or create GoalSheet for this user
      let sheet = await prisma.goalSheet.findUnique({
        where: { userId_cycleId: { userId, cycleId: cycle.id } },
      });

      if (!sheet) {
        sheet = await prisma.goalSheet.create({
          data: {
            userId,
            cycleId: cycle.id,
            status: "DRAFT",
          },
        });
      }

      if (sheet.status !== "DRAFT" && sheet.status !== "REWORK") {
        errors.push(`User ${userId} sheet is locked (${sheet.status}).`);
        continue;
      }

      const existingGoalsCount = await prisma.goal.count({
        where: { sheetId: sheet.id },
      });

      if (existingGoalsCount >= 8) {
        errors.push(`User ${userId} already has 8 goals.`);
        continue;
      }

      await prisma.goal.create({
        data: {
          sheetId: sheet.id,
          title: data.title,
          description: data.description,
          thrustAreaId: data.thrustAreaId,
          uomType: data.uomType,
          targetValue: data.targetValue,
          targetDate: data.targetDate,
          weightage: data.defaultWeightage,
          isShared: true,
        },
      });

      // Optional: Add notification for the user
      await prisma.notification.create({
        data: {
          userId,
          type: "SHARED_GOAL_RECEIVED",
          title: "New Shared Goal Received",
          message: `A shared goal "${data.title}" has been pushed to your goal sheet.`,
          link: "/dashboard/goals",
        }
      });

      successCount++;
    } catch (err) {
      console.error(err);
      errors.push(`Failed for user ${userId}.`);
    }
  }

  return NextResponse.json({
    message: `Successfully pushed shared goal to ${successCount} users.`,
    errors,
  });
}
