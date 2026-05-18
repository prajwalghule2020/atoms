import { NextResponse } from "next/server";

import { prisma } from "@repo/db";

import { authorize } from "@/lib/server-auth";

export async function POST(request: Request) {
  const result = await authorize(request);
  if ("response" in result) return result.response;

  await prisma.notification.updateMany({
    where: { userId: result.user.id, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
