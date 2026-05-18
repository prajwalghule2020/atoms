import { NextResponse } from "next/server";

import { prisma } from "@repo/db";

import { authorize } from "@/lib/server-auth";

export async function GET(request: Request) {
  const result = await authorize(request);
  if ("response" in result) return result.response;

  const notifications = await prisma.notification.findMany({
    where: { userId: result.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const unreadCount = await prisma.notification.count({
    where: { userId: result.user.id, isRead: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}
