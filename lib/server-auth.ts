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

type SupabaseAuthClientResult =
  | { ok: true; supabase: ReturnType<typeof createClient> }
  | { ok: false; response: Response };

function getSupabaseAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Server misconfigured: missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and a key)",
        },
        { status: 500 }
      ),
    } satisfies SupabaseAuthClientResult;
  }

  return {
    ok: true,
    supabase: createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  } satisfies SupabaseAuthClientResult;
}

export async function authorize(
  request: Request,
  roles?: AuthRole[]
): Promise<{ user: AuthUser } | { response: Response }> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return {
        response: NextResponse.json(
          { error: "Missing or invalid Authorization header" },
          { status: 401 }
        ),
      };
    }

    const supabaseResult = getSupabaseAuthClient();
    if (!supabaseResult.ok) return { response: supabaseResult.response };
    const { supabase } = supabaseResult;

    if (!process.env.DATABASE_URL) {
      return {
        response: NextResponse.json(
          { error: "Server misconfigured: missing DATABASE_URL" },
          { status: 500 }
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
  } catch (err) {
    console.error("authorize() failed", err);
    return {
      response: NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      ),
    };
  }
}
