"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, ChevronRight, Loader2, RefreshCw, Send } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type PendingSheet = { id: string; status: "SUBMITTED" | "UNDER_REVIEW"; updatedAt: string; user: { id: string; name: string; email: string; department: { name: string } | null }; goals: { id: string; title: string; weightage: number }[] };

export default function ManagerApprovalsPage() {
  const [sheets, setSheets] = useState<PendingSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PendingSheet[]>("/api/manager/approvals").then(setSheets).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Approval Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">{sheets.length === 0 ? "All caught up — no pending reviews" : `${sheets.length} goal sheet${sheets.length !== 1 ? "s" : ""} awaiting your review`}</p>
      </div>
      {error && <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {!error && sheets.length === 0 && (
        <Card><CardContent className="flex flex-col items-center justify-center py-20 text-center"><CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" /><p className="font-medium text-lg">All caught up!</p><p className="text-sm text-muted-foreground mt-1">No goal sheets are waiting for your review.</p><Link href="/manager/dashboard" className="mt-4"><Button variant="outline">Back to Dashboard</Button></Link></CardContent></Card>
      )}
      <div className="space-y-4">
        {sheets.map((sheet) => {
          const totalWeightage = sheet.goals.reduce((sum, goal) => sum + goal.weightage, 0);
          const waitingDays = Math.floor((Date.now() - new Date(sheet.updatedAt).getTime()) / 86_400_000);
          return (
            <Card key={sheet.id} className={cn("transition-shadow hover:shadow-md", waitingDays >= 3 && "border-amber-300 dark:border-amber-700")}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">{sheet.user.name.charAt(0).toUpperCase()}</div>
                    <div><CardTitle className="text-base">{sheet.user.name}</CardTitle><CardDescription className="text-xs">{sheet.user.department?.name ?? sheet.user.email}</CardDescription></div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {waitingDays >= 3 && <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs gap-1"><RefreshCw className="h-3 w-3" />{waitingDays}d waiting</Badge>}
                    <div className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", sheet.status === "SUBMITTED" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40")}><Send className="h-3 w-3" />{sheet.status === "SUBMITTED" ? "Submitted" : "Under Review"}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-6 text-sm"><div><span className="text-muted-foreground">Goals: </span><span className="font-medium">{sheet.goals.length}</span></div><div><span className="text-muted-foreground">Total Weight: </span><span className={cn("font-medium", totalWeightage === 100 ? "text-emerald-600" : "text-amber-600")}>{totalWeightage}%</span></div><div><span className="text-muted-foreground">Submitted: </span><span className="font-medium">{new Date(sheet.updatedAt).toLocaleDateString()}</span></div></div>
                <div className="flex flex-wrap gap-1.5">{sheet.goals.slice(0, 4).map((g) => <span key={g.id} className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{g.title.length > 35 ? `${g.title.slice(0, 35)}…` : g.title}<span className="ml-1.5 font-medium text-foreground">{g.weightage}%</span></span>)}{sheet.goals.length > 4 && <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">+{sheet.goals.length - 4} more</span>}</div>
                <div className="flex justify-end"><Link href={`/manager/review/${sheet.id}`}><Button className="gap-2">Review Goals<ChevronRight className="h-4 w-4" /></Button></Link></div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
