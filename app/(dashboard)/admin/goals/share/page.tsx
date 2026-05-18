import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@repo/db";
import { ShareGoalClient } from "./share-goal-client";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Share Goal | Admin | Atoms",
};

export default async function ShareGoalPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (dbUser?.role !== "ADMIN" && dbUser?.role !== "MANAGER") {
    redirect("/dashboard");
  }

  const cycle = await prisma.cycle.findFirst({
    where: { isActive: true },
    include: { thrustAreas: true },
  });

  const users = await prisma.user.findMany({
    where: { role: "EMPLOYEE" },
    select: { id: true, name: true, department: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  if (!cycle) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
          <h2 className="mt-6 text-xl font-semibold">No Active Cycle</h2>
          <p className="mb-8 mt-2 text-center text-sm font-normal leading-6 text-muted-foreground">
            Please create and activate a performance cycle before pushing shared goals.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Push Shared Goal</h1>
        <p className="text-muted-foreground mt-2">
          Create a goal and distribute it to multiple team members. Shared goals cannot be edited by the recipients.
        </p>
      </div>
      <ShareGoalClient thrustAreas={cycle.thrustAreas} users={users} />
    </div>
  );
}
