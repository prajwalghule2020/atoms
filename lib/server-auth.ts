import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { prisma } from "@repo/db";

export type AuthRole = "EMPLOYEE" | "MANAGER" | "ADMIN";

export type AuthUser = {
  id: string;
  email: string;
  role: AuthRole;
  managerId?: string | null;
  departmentId?: string | null;
  name: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseSecret = process.env.SUPABASE_SECRET_KEY ?? "";
const supabase = createClient(supabaseUrl, supabaseSecret);

export async function authorize(
  request: Request,
  roles?: AuthRole[]
): Promise<{ user: AuthUser } | { response: NextResponse }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      response: NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return {
      response: NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      ),
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: data.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      managerId: true,
      departmentId: true,
    },
  });

  if (!dbUser) {
    return {
      response: NextResponse.json(
        { error: "User not found in the system" },
        { status: 403 }
      ),
    };
  }

  const user: AuthUser = {
    ...dbUser,
    role: dbUser.role as AuthRole,
  };

  if (roles && !roles.includes(user.role)) {
    return {
      response: NextResponse.json(
        { error: `Access denied. Required role: ${roles.join(" or ")}` },
        { status: 403 }
      ),
    };
  }

  return { user };
}
