"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, CheckSquare, ChevronRight, ClipboardList, Clock, Loader2, RefreshCw, Send, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type SheetStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REWORK";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  department: string | null;
  sheet: {
    id: string;
    status: SheetStatus;
    updatedAt: string;
    goalCount: number;
    totalWeightage: number;
  } | null;
};

type TeamData = { cycle: { id: string; name: string; year: number } | null; team: TeamMember[] };

const STATUS_CONFIG: Record<SheetStatus, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { label: "Draft", color: "text-slate-600 bg-slate-100 dark:bg-slate-800", icon: <Clock className="h-3 w-3" /> },
  SUBMITTED: { label: "Submitted", color: "text-blue-700 bg-blue-100 dark:bg-blue-900/40", icon: <Send className="h-3 w-3" /> },
  UNDER_REVIEW: { label: "Under Review", color: "text-amber-700 bg-amber-100 dark:bg-amber-900/40", icon: <RefreshCw className="h-3 w-3" /> },
  APPROVED: { label: "Approved", color: "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40", icon: <CheckCircle2 className="h-3 w-3" /> },
  REWORK: { label: "Rework", color: "text-orange-700 bg-orange-100 dark:bg-orange-900/40", icon: <AlertCircle className="h-3 w-3" /> },
};

export default function ManagerDashboardClient() {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<TeamData>("/api/manager/team")
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    return <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>;
  }

  const team = data?.team ?? [];
  const pendingCount = team.filter((member) => member.sheet && ["SUBMITTED", "UNDER_REVIEW"].includes(member.sheet.status)).length;
  const approvedCount = team.filter((member) => member.sheet?.status === "APPROVED").length;
  const noSheetCount = team.filter((member) => !member.sheet).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">{data?.cycle ? `${data.cycle.name} · FY ${data.cycle.year}` : "No active cycle"}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant={pendingCount > 0 ? "default" : "outline"} className="gap-2" asChild>
            <Link href="/manager/approvals"><CheckSquare className="h-4 w-4" />Approvals{pendingCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground text-primary text-[10px] font-bold px-1">{pendingCount > 9 ? "9+" : pendingCount}</span>}</Link>
          </Button>
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/manager/checkins"><ClipboardList className="h-4 w-4" />Check-ins</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Team Members", value: team.length, sub: "Direct reports", icon: <Users className="h-4 w-4 text-muted-foreground" /> },
          { label: "Pending Approval", value: pendingCount, sub: "Awaiting review", icon: <AlertCircle className="h-4 w-4 text-amber-500" />, highlight: pendingCount > 0 },
          { label: "Approved", value: approvedCount, sub: "Goal sheets locked", icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> },
          { label: "Not Started", value: noSheetCount, sub: "No sheet created", icon: <Clock className="h-4 w-4 text-muted-foreground" /> },
        ].map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
              {card.icon}
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", card.highlight && "text-amber-600")}>{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Overview</CardTitle>
          <CardDescription>Goal sheet status for each direct report</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {team.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No direct reports found</div>
          ) : (
            <div className="divide-y">
              {team.map((member) => {
                const cfg = member.sheet ? STATUS_CONFIG[member.sheet.status] : null;
                const isPending = member.sheet && ["SUBMITTED", "UNDER_REVIEW"].includes(member.sheet.status);
                return (
                  <div key={member.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/40 transition-colors">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">{member.name.charAt(0).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.department ?? member.email}</p>
                    </div>
                    {member.sheet ? (
                      <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{member.sheet.goalCount} goals</span>
                        <span className={cn(member.sheet.totalWeightage === 100 ? "text-emerald-600" : "text-amber-600")}>{member.sheet.totalWeightage}% weight</span>
                      </div>
                    ) : (
                      <span className="hidden sm:block text-xs text-muted-foreground">No sheet yet</span>
                    )}
                    {cfg ? (
                      <div className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shrink-0", cfg.color)}>{cfg.icon}{cfg.label}</div>
                    ) : (
                      <Badge variant="outline" className="text-xs shrink-0">Not Started</Badge>
                    )}
                    {isPending && member.sheet && (
                      <Link href={`/manager/review/${member.sheet.id}`}>
                        <Button size="sm" variant="outline" className="gap-1 shrink-0">Review<ChevronRight className="h-3.5 w-3.5" /></Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
