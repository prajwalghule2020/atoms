import { NextResponse } from "next/server";

import { authorize } from "@/lib/server-auth";

export async function GET(request: Request) {
  const result = await authorize(request);
  if ("response" in result) return result.response;

  return NextResponse.json(result.user);
}
