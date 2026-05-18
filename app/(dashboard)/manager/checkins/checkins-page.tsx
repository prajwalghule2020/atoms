"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, ChevronRight, Loader2, MessageSquarePlus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
type GridRow = { memberId: string; name: string; email: string; sheetStatus: string | null; sheetId: string | null; checkins: Record<string, boolean>; avgScores: Record<string, number | null> };
type StatusData = { cycle: { id: string; name: string } | null; openQuarters: Quarter[]; grid: GridRow[] };

export default function ManagerCheckinsPage() {
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTarget, setDialogTarget] = useState<{ sheetId: string; name: string; quarter: Quarter } | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [detailQ, setDetailQ] = useState<Quarter | null>(null);
  const [detailData, setDetailData] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    apiFetch<StatusData>("/api/manager/checkin-status")
      .then((d) => {
        setStatusData(d);
        if (d.openQuarters.length) setDetailQ(d.openQuarters[d.openQuarters.length - 1] as Quarter);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!detailQ) return;
    setDetailLoading(true);
    apiFetch<any[]>(`/api/manager/checkins/${detailQ}`)
      .then(setDetailData)
      .catch(() => setDetailData([]))
      .finally(() => setDetailLoading(false));
  }, [detailQ]);

  function openCheckinDialog(sheetId: string, name: string, quarter: Quarter) {
    setDialogTarget({ sheetId, name, quarter });
    setComment("");
    setSubmitError(null);
    setDialogOpen(true);
  }

  async function submitCheckin() {
    if (!dialogTarget) return;
    if (comment.trim().length < 20) {
      setSubmitError("Check-in comment must be at least 20 characters");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiFetch("/api/manager/checkin", { method: "POST", body: JSON.stringify({ sheetId: dialogTarget.sheetId, quarter: dialogTarget.quarter, comment }) });
      setStatusData((prev) => prev ? { ...prev, grid: prev.grid.map((row) => row.sheetId !== dialogTarget.sheetId ? row : { ...row, checkins: { ...row.checkins, [dialogTarget.quarter]: true } }) } : prev);
      setDialogOpen(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to save check-in");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  const openQuarters = statusData?.openQuarters ?? [];
  const grid = statusData?.grid ?? [];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">Manager Check-ins</h1><p className="text-sm text-muted-foreground mt-1">{statusData?.cycle?.name ?? "No active cycle"} · Record structured check-in conversations for your team</p></div>
      {error && <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      <Card>
        <CardHeader><CardTitle className="text-base">Completion Tracker</CardTitle><CardDescription>Check-in status for each team member × open quarter. Scores shown are weighted averages.</CardDescription></CardHeader>
        <CardContent className="p-0">
          {grid.length === 0 ? <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No approved goal sheets found in your team</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/40"><th className="text-left px-6 py-3 font-medium">Team Member</th>{openQuarters.map((q) => <th key={q} className="text-center px-4 py-3 font-medium w-28">{q}</th>)}<th className="px-4 py-3 w-12" /></tr></thead><tbody className="divide-y">{grid.map((row) => (<tr key={row.memberId} className="hover:bg-muted/30 transition-colors"><td className="px-6 py-4"><div className="flex items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{row.name.charAt(0).toUpperCase()}</div><div><p className="font-medium">{row.name}</p><p className="text-xs text-muted-foreground">{row.email}</p></div></div></td>{openQuarters.map((q) => { const done = row.checkins[q] ?? false; const score = row.avgScores[q]; const hasSheet = !!row.sheetId && row.sheetStatus === "APPROVED"; return <td key={q} className="px-4 py-4 text-center">{!hasSheet ? <span className="text-xs text-muted-foreground">No sheet</span> : done ? <div className="flex flex-col items-center gap-1"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{score !== null && score !== undefined && <span className={cn("text-[10px] font-semibold", score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600")}>{score}%</span>}</div> : <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-primary hover:bg-primary/10" onClick={() => row.sheetId && openCheckinDialog(row.sheetId, row.name, q)}><MessageSquarePlus className="h-3.5 w-3.5" />Add</Button>}</td>; })}<td className="px-4 py-4">{row.sheetId && <a href={`/manager/review/${row.sheetId}`} className="text-muted-foreground hover:text-foreground transition-colors"><ChevronRight className="h-4 w-4" /></a>}</td></tr>))}</tbody></table></div>}
        </CardContent>
      </Card>
      {openQuarters.length > 0 && <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="text-base">{detailQ} — Team Actuals</CardTitle><CardDescription>All approved team goals and their recorded actuals for this quarter</CardDescription></div><div className="flex gap-1.5">{openQuarters.map((q) => <button key={q} onClick={() => setDetailQ(q)} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", detailQ === q ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>{q}</button>)}</div></div></CardHeader><CardContent className="p-0">{detailLoading ? <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : detailData.length === 0 ? <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No approved sheets or actuals recorded yet for {detailQ}</div> : <div className="divide-y">{detailData.map((sheet: any) => <div key={sheet.id} className="px-6 py-4 space-y-3"><div className="flex items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{sheet.user.name.charAt(0).toUpperCase()}</div><div className="flex-1"><p className="font-medium text-sm">{sheet.user.name}</p><p className="text-xs text-muted-foreground">{sheet.user.email}</p></div><div className="text-xs text-muted-foreground">{sheet.goals.length} goals</div></div><div className="ml-11 border rounded-md overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-muted/30 border-b"><th className="text-left px-3 py-2 font-medium">Goal</th><th className="text-center px-3 py-2 font-medium w-20">Target</th><th className="text-center px-3 py-2 font-medium w-20">Actual</th><th className="text-center px-3 py-2 font-medium w-16">Score</th><th className="text-center px-3 py-2 font-medium w-20">Status</th></tr></thead><tbody className="divide-y">{sheet.goals.map((goal: any) => { const update = goal.quarterlyUpdates[0]; const score = update?.computedScore !== null && update?.computedScore !== undefined ? Math.round(update.computedScore * 100) : null; return (<tr key={goal.id} className="hover:bg-muted/20"><td className="px-3 py-2 max-w-[200px] truncate" title={goal.title}>{goal.title}</td><td className="px-3 py-2 text-center text-muted-foreground">{goal.targetValue ?? goal.targetDate?.slice(0, 10) ?? "—"}</td><td className="px-3 py-2 text-center">{update ? (update.actualValue ?? update.actualDate?.slice(0, 10) ?? "—") : <span className="text-muted-foreground">Not entered</span>}</td><td className="px-3 py-2 text-center">{score !== null ? <span className={cn("font-semibold", score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600")}>{score}%</span> : "—"}</td><td className="px-3 py-2 text-center">{update?.status ? update.status.replace("_", " ") : <span className="text-muted-foreground">—</span>}</td></tr>); })}</tbody></table></div></div>)}</div>}</CardContent></Card>}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); setSubmitError(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MessageSquarePlus className="h-5 w-5 text-primary" />{dialogTarget?.quarter} Check-in — {dialogTarget?.name}</DialogTitle>
            <DialogDescription>Record your structured check-in conversation notes. Be specific about observations, blockers, and next steps discussed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea placeholder="What was discussed? Any blockers, achievements, or action items from the conversation…" className="resize-none h-36" value={comment} onChange={(e) => setComment(e.target.value)} />
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
            <p className="text-xs text-muted-foreground">{comment.length}/3000 characters (min 20)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitCheckin} disabled={submitting} className="gap-2">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}Save Check-in</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
