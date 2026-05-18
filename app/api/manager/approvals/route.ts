import { NextResponse } from "next/server";

import { prisma } from "@repo/db";

import { authorize } from "@/lib/server-auth";

export async function GET(request: Request) {
  const result = await authorize(request, ["MANAGER", "ADMIN"]);
  if ("response" in result) return result.response;

  const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!activeCycle) {
    return NextResponse.json([]);
  }

  const sheets = await prisma.goalSheet.findMany({
    where: {
      cycleId: activeCycle.id,
      status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
      user: { managerId: result.user.id },
    },
    include: {
      user: { select: { id: true, name: true, email: true, department: { select: { name: true } } } },
      goals: { select: { id: true, weightage: true, title: true } },
    },
    orderBy: { updatedAt: "asc" },
  });

  return NextResponse.json(sheets);
}
