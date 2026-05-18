import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { headers } from "next/headers";

/**
 * Cron Job: Process Automated Escalations
 * 
 * Reads EscalationRule config from the DB, evaluates rules against the current
 * cycle, and creates in-app Notifications for relevant users.
 * 
 * Protected by CRON_SECRET header in production.
 * Schedule: run this daily via Vercel Cron, system cron, or similar.
 */
export async function GET(request: Request) {
  const reqHeaders = await headers();
  const authHeader = reqHeaders.get("authorization");

  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cycle = await prisma.cycle.findFirst({
      where: { isActive: true },
      include: { escalationRules: { where: { active: true } } },
    });

    if (!cycle) {
      return NextResponse.json({ message: "No active cycle. Skipping escalations." });
    }

    const now = new Date();
    const cycleStartDate = cycle.goalSettingOpen ?? cycle.createdAt;
    const daysSinceCycleStart = Math.floor((now.getTime() - cycleStartDate.getTime()) / (1000 * 3600 * 24));
    const notificationsCreated: string[] = [];

    // ── Rule: GOAL_NOT_SUBMITTED ──────────────────────────────────────────────
    const notSubmittedRule = cycle.escalationRules.find(
      r => r.triggerType === "GOAL_NOT_SUBMITTED"
    );
    const notSubmittedThreshold = notSubmittedRule?.daysThreshold ?? 14; // default 14 days

    if (daysSinceCycleStart >= notSubmittedThreshold) {
      const draftSheets = await prisma.goalSheet.findMany({
        where: { cycleId: cycle.id, status: "DRAFT" },
        include: { user: { select: { id: true, name: true, managerId: true } } },
      });

      for (const sheet of draftSheets) {
        if (!sheet.user.managerId) continue;

        // Avoid duplicate notifications — check if one was sent in the last 7 days
        const recentNotif = await prisma.notification.findFirst({
          where: {
            userId: sheet.user.managerId,
            type: "ESCALATION",
            message: { contains: sheet.user.id },
            createdAt: { gte: new Date(now.getTime() - 7 * 24 * 3600 * 1000) },
          },
        });

        if (!recentNotif) {
          await prisma.notification.create({
            data: {
              userId: sheet.user.managerId,
              type: "ESCALATION",
              title: "Goal Sheet Not Submitted",
              message: `${sheet.user.name} (${sheet.user.id}) has not submitted their goals for ${cycle.name}. Please follow up.`,
              link: `/manager/team`,
            },
          });
          notificationsCreated.push(`GOAL_NOT_SUBMITTED → manager of ${sheet.user.name}`);
        }
      }
    }

    // ── Rule: GOAL_NOT_APPROVED ───────────────────────────────────────────────
    const notApprovedRule = cycle.escalationRules.find(
      r => r.triggerType === "GOAL_NOT_APPROVED"
    );
    const notApprovedThreshold = notApprovedRule?.daysThreshold ?? 7; // default 7 days

    const submittedSheets = await prisma.goalSheet.findMany({
      where: { cycleId: cycle.id, status: "SUBMITTED" },
      include: {
        user: { select: { id: true, name: true, managerId: true } },
      },
    });

    for (const sheet of submittedSheets) {
      const daysSinceSubmit = Math.floor((now.getTime() - sheet.updatedAt.getTime()) / (1000 * 3600 * 24));
      if (daysSinceSubmit < notApprovedThreshold) continue;

      // Escalate to an admin
      const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
      if (!adminUser) continue;

      const recentNotif = await prisma.notification.findFirst({
        where: {
          userId: adminUser.id,
          type: "ESCALATION",
          message: { contains: sheet.userId },
          createdAt: { gte: new Date(now.getTime() - 7 * 24 * 3600 * 1000) },
        },
      });

      if (!recentNotif) {
        await prisma.notification.create({
          data: {
            userId: adminUser.id,
            type: "ESCALATION",
            title: "Goal Sheet Pending Approval",
            message: `${sheet.user.name}'s (${sheet.userId}) goal sheet has been waiting for manager approval for ${daysSinceSubmit} days.`,
            link: `/admin/users`,
          },
        });
        notificationsCreated.push(`GOAL_NOT_APPROVED → admin for ${sheet.user.name}`);
      }
    }

    return NextResponse.json({
      message: "Escalations processed successfully",
      notificationsCreated: notificationsCreated.length,
      details: notificationsCreated,
    });
  } catch (err) {
    console.error("Escalation cron error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
