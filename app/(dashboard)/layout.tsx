import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { NotificationBell } from "@/components/layout/notification-bell";
import { MobileHeaderTrigger } from "@/components/layout/mobile-header-trigger";

type Role = "EMPLOYEE" | "MANAGER" | "ADMIN";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true, role: true },
  });

  const role: Role = (dbUser?.role as Role) ?? "EMPLOYEE";
  const name = dbUser?.name ?? user.email ?? "User";
  const email = dbUser?.email ?? user.email ?? "";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar user={{ name, email, role }} />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background/95 backdrop-blur-sm px-4 gap-3 sticky top-0 z-30">
          <MobileHeaderTrigger />
          <div className="flex items-center gap-2 ml-auto">
            <NotificationBell />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
