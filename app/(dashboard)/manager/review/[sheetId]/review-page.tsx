"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, RotateCcw, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type Goal = { id: string; title: string; description?: string | null; thrustArea: { name: string }; uomType: "NUMERIC_MIN" | "NUMERIC_MAX" | "TIMELINE" | "ZERO"; targetValue?: number | null; targetDate?: string | null; weightage: number; isShared: boolean };
type ReviewSheet = { id: string; status: string; reworkComment?: string | null; updatedAt: string; user: { id: string; name: string; email: string; department: { name: string } | null; manager: { id: string; name: string } | null }; goals: Goal[]; cycle: { id: string; name: string; year: number } };

const UOM_LABELS: Record<string, string> = { NUMERIC_MIN: "↑ Higher is better", NUMERIC_MAX: "↓ Lower is better", TIMELINE: "📅 Date-based", ZERO: "0 Zero target" };

export default function ReviewPage() {
  const { sheetId } = useParams<{ sheetId: string }>();
  const router = useRouter();

  const [sheet, setSheet] = useState<ReviewSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reworkComment, setReworkComment] = useState("");
  const [returning, setReturning] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ReviewSheet>(`/api/manager/review/${sheetId}`)
      .then(setSheet)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sheetId]);

  const totalWeightage = sheet?.goals.reduce((sum, goal) => sum + goal.weightage, 0) ?? 0;
  const isActionable = sheet && ["SUBMITTED", "UNDER_REVIEW"].includes(sheet.status);

  async function handleApprove() {
    setApproving(true);
    try {
      await apiFetch(`/api/goals/sheet/${sheetId}/approve`, { method: "POST" });
      setApproveConfirmOpen(false);
      router.push("/manager/approvals");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setApproving(false);
    }
  }

  async function handleReturn() {
    if (reworkComment.trim().length < 10) {
      setReturnError("Please provide at least 10 characters of feedback");
      return;
    }
    setReturning(true);
    setReturnError(null);
    try {
      await apiFetch(`/api/goals/sheet/${sheetId}/return`, { method: "POST", body: JSON.stringify({ reworkComment }) });
      setReturnOpen(false);
      router.push("/manager/approvals");
    } catch (e) {
      setReturnError(e instanceof Error ? e.message : "Failed to return sheet");
    } finally {
      setReturning(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  if (error || !sheet) {
    return <div className="flex flex-col items-center justify-center min-h-[400px] gap-4"><div className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error ?? "Goal sheet not found"}</div><Link href="/manager/approvals"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back to Queue</Button></Link></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Link href="/manager/approvals" className="hover:text-foreground transition-colors">Approval Queue</Link><span>/</span><span className="text-foreground font-medium">{sheet.user.name}</span></div>
      <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary text-lg font-bold">{sheet.user.name.charAt(0).toUpperCase()}</div><div><h1 className="text-2xl font-semibold">{sheet.user.name}</h1><p className="text-sm text-muted-foreground">{sheet.user.department?.name ?? sheet.user.email} · {sheet.cycle.name}</p></div></div>{isActionable && <div className="flex items-center gap-2 shrink-0"><Button variant="outline" className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30" onClick={() => setReturnOpen(true)}><ThumbsDown className="h-4 w-4" />Return for Rework</Button><Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setApproveConfirmOpen(true)}><ThumbsUp className="h-4 w-4" />Approve</Button></div>}</div>
      <div className="flex items-center gap-4 rounded-lg border bg-card px-5 py-3"><div className="flex-1"><p className="text-xs text-muted-foreground">Total Weightage</p><p className={cn("text-2xl font-bold", totalWeightage === 100 ? "text-emerald-600" : "text-amber-600")}>{totalWeightage}%</p></div><Separator orientation="vertical" className="h-10" /><div className="flex-1"><p className="text-xs text-muted-foreground">Goal Count</p><p className="text-2xl font-bold">{sheet.goals.length}</p></div><Separator orientation="vertical" className="h-10" /><div className="flex-1"><p className="text-xs text-muted-foreground">Submitted</p><p className="text-sm font-medium mt-1">{new Date(sheet.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p></div></div>
      <Card><CardHeader><CardTitle className="text-base">Goals</CardTitle><CardDescription>Review each goal before approving or returning for revision</CardDescription></CardHeader><CardContent className="p-0"><div className="divide-y">{sheet.goals.map((goal, index) => (<div key={goal.id} className="flex items-start gap-4 px-6 py-4"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-bold mt-0.5">{index + 1}</div><div className="flex-1 min-w-0 space-y-1.5"><div className="flex items-center gap-2 flex-wrap"><p className="font-medium text-sm">{goal.title}</p>{goal.isShared && <Badge variant="secondary" className="gap-1 text-xs"><Share2 className="h-3 w-3" />Shared</Badge>}</div>{goal.description && <p className="text-xs text-muted-foreground">{goal.description}</p>}<div className="flex items-center gap-2 flex-wrap text-xs"><Badge variant="outline">{goal.thrustArea.name}</Badge><span className="text-muted-foreground">{UOM_LABELS[goal.uomType]}</span>{goal.targetValue !== null && goal.targetValue !== undefined && <span className="text-muted-foreground">Target: {goal.targetValue}</span>}{goal.targetDate && <span className="text-muted-foreground">By: {new Date(goal.targetDate).toLocaleDateString()}</span>}</div></div><div className="shrink-0 flex flex-col items-center justify-center rounded-lg bg-muted px-3 py-1.5 min-w-[56px]"><span className="text-base font-bold">{goal.weightage}%</span><span className="text-[10px] text-muted-foreground">weight</span></div></div>))}</div></CardContent></Card>
      <Dialog open={approveConfirmOpen} onOpenChange={setApproveConfirmOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" />Approve Goal Sheet</DialogTitle><DialogDescription>You are about to approve <strong>{sheet.user.name}</strong>&apos;s goal sheet. This will lock the sheet and notify the employee. This action cannot be undone without admin intervention.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setApproveConfirmOpen(false)}>Cancel</Button><Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={handleApprove} disabled={approving}>{approving && <Loader2 className="h-4 w-4 animate-spin" />}Confirm Approval</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={returnOpen} onOpenChange={(o) => { setReturnOpen(o); setReturnError(null); }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-amber-500" />Return for Rework</DialogTitle><DialogDescription>Provide clear feedback so <strong>{sheet.user.name}</strong> knows what to revise. The sheet will be re-opened for editing.</DialogDescription></DialogHeader><div className="space-y-2"><Textarea placeholder="Describe what needs to be changed — be specific about which goals to revise and why…" className="resize-none h-32" value={reworkComment} onChange={(e) => setReworkComment(e.target.value)} />{returnError && <p className="text-sm text-destructive">{returnError}</p>}<p className="text-xs text-muted-foreground">{reworkComment.length}/2000 characters (min 10)</p></div><DialogFooter><Button variant="outline" onClick={() => { setReturnOpen(false); setReturnError(null); }}>Cancel</Button><Button variant="default" className="gap-2" onClick={handleReturn} disabled={returning}>{returning && <Loader2 className="h-4 w-4 animate-spin" />}Return with Feedback</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
