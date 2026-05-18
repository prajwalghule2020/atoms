"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, BarChart3, CheckCircle2, FileText, Loader2, Settings, Users, Share2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AnalyticsClient } from "./analytics-client";

type ReportData = { cycle: { id: string; name: string; year: number } | null; summary: { total: number; submitted: number; approved: number; completionPct: number } | null; departments: { name: string; totalEmployees: number; approvedSheets: number; avgScore: number | null }[] };
type CompletionData = { cycle: { id: string; name: string } | null; notSubmitted: { id: string; name: string; email: string; department: string | null; manager: string | null; sheetStatus: string | null; lastActivity: string | null }[] };

export default function AdminDashboardClient() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [completion, setCompletion] = useState<CompletionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { Promise.all([apiFetch<ReportData>("/api/admin/reports/achievement"), apiFetch<CompletionData>("/api/admin/reports/completion")]).then(([r, c]) => { setReport(r); setCompletion(c); }).catch(() => {}).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  const summary = report?.summary;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1><p className="text-sm text-muted-foreground mt-1">{report?.cycle ? `${report.cycle.name} · FY ${report.cycle.year}` : "No active cycle"}</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{ label: "Total Employees", value: summary?.total ?? "—", icon: <Users className="h-4 w-4 text-muted-foreground" /> }, { label: "Submitted", value: summary?.submitted ?? "—", icon: <FileText className="h-4 w-4 text-blue-500" />, sub: `of ${summary?.total ?? 0}` }, { label: "Approved", value: summary?.approved ?? "—", icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, sub: `of ${summary?.total ?? 0}` }, { label: "Completion %", value: report?.summary ? `${summary?.completionPct}%` : "—", icon: <BarChart3 className="h-4 w-4 text-primary" />, highlight: (summary?.completionPct ?? 0) >= 80 }].map((card) => (<Card key={card.label}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{card.label}</CardTitle>{card.icon}</CardHeader><CardContent><div className={cn("text-2xl font-bold", card.highlight && "text-emerald-600")}>{card.value}</div>{card.sub && <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>}</CardContent></Card>))}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[{ label: "Manage Cycles", href: "/admin/cycles", icon: <Settings className="h-5 w-5" />, color: "text-primary" }, { label: "Manage Users", href: "/admin/users", icon: <Users className="h-5 w-5" />, color: "text-blue-500" }, { label: "Reports", href: "/admin/reports", icon: <BarChart3 className="h-5 w-5" />, color: "text-emerald-500" }, { label: "Audit Trail", href: "/admin/audit", icon: <FileText className="h-5 w-5" />, color: "text-amber-500" }, { label: "Share Goals", href: "/admin/goals/share", icon: <Share2 className="h-5 w-5" />, color: "text-purple-500" }].map((link) => (<Link key={link.href} href={link.href}><Card className="hover:shadow-md transition-shadow cursor-pointer group"><CardContent className="flex items-center gap-3 py-4"><div className={cn("shrink-0", link.color)}>{link.icon}</div><span className="text-sm font-medium group-hover:text-primary transition-colors">{link.label}</span></CardContent></Card></Link>))}</div>
      
      <div className="pt-2 pb-2">
        <AnalyticsClient />
      </div>

      {report && report.departments.length > 0 && <Card><CardHeader><CardTitle className="text-base">Department Breakdown</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/40"><th className="text-left px-6 py-3 font-medium">Department</th><th className="text-center px-4 py-3 font-medium">Employees</th><th className="text-center px-4 py-3 font-medium">Approved</th><th className="text-center px-4 py-3 font-medium">Avg Score</th></tr></thead><tbody className="divide-y">{report.departments.map((dept, i) => (<tr key={`dept-${i}`} className="hover:bg-muted/30"><td className="px-6 py-3 font-medium">{dept.name}</td><td className="px-4 py-3 text-center">{dept.totalEmployees}</td><td className="px-4 py-3 text-center">{dept.approvedSheets}</td><td className="px-4 py-3 text-center">{dept.avgScore !== null ? <span className={cn("font-semibold", dept.avgScore >= 80 ? "text-emerald-600" : dept.avgScore >= 50 ? "text-amber-600" : "text-red-600")}>{dept.avgScore}%</span> : "—"}</td></tr>))}</tbody></table></div></CardContent></Card>}
      {completion && completion.notSubmitted.length > 0 && <Card className="border-amber-200 dark:border-amber-800"><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400"><AlertCircle className="h-4 w-4" />{completion.notSubmitted.length} Employees Haven&apos;t Submitted</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{completion.notSubmitted.slice(0, 8).map((u) => <span key={u.id} className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">{u.name}</span>)}{completion.notSubmitted.length > 8 && <Link href="/admin/reports"><span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer">+{completion.notSubmitted.length - 8} more →</span></Link>}</div></CardContent></Card>}
    </div>
  );
}
