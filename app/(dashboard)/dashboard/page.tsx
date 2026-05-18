import type { Metadata } from "next";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, FileText, Target } from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function EmployeeDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">FY 2025-26 · Goal Setting &amp; Tracking</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Goal Sheet</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Draft</div>
            <p className="text-xs text-muted-foreground mt-1">Not yet submitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Goals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground mt-1">4 goals · 100% weightage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Quarter</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Q1</div>
            <p className="text-xs text-muted-foreground mt-1">Opens July 2025</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Check-ins Done</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 / 4</div>
            <p className="text-xs text-muted-foreground mt-1">Quarterly check-ins</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cycle Timeline — FY 2025-26</CardTitle>
          <CardDescription>Upcoming phases and check-in windows</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { phase: "Goal Setting", date: "May 1, 2025", status: "active", description: "Create and submit your goal sheet" },
              { phase: "Q1 Check-in", date: "July 1, 2025", status: "upcoming", description: "Log Q1 actuals vs planned targets" },
              { phase: "Q2 Check-in", date: "October 1, 2025", status: "upcoming", description: "Log Q2 actuals vs planned targets" },
              { phase: "Q3 Check-in", date: "January 1, 2026", status: "upcoming", description: "Log Q3 actuals vs planned targets" },
              { phase: "Q4 / Annual", date: "March 1, 2026", status: "upcoming", description: "Final achievement capture" },
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="mt-0.5">
                  {item.status === "active" ? (
                    <div className="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/20" />
                  ) : (
                    <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{item.phase}</p>
                    {item.status === "active" && <Badge variant="default" className="text-xs">Active</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.date} · {item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
