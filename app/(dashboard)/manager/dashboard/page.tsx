import type { Metadata } from "next";

import ManagerDashboardClient from "./dashboard-client";

export const metadata: Metadata = { title: "Team Dashboard" };
export const dynamic = "force-dynamic";

export default function ManagerDashboardPage() {
  return <ManagerDashboardClient />;
}
