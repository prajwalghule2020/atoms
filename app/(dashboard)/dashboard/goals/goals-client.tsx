"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  AlertTriangle,
} from "lucide-react";
import { WeightageBar } from "@/components/goals/weightage-bar";
import { GoalList } from "@/components/goals/goal-list";
import {
  GoalFormDialog,
  type Goal,
  type ThrustArea,
} from "@/components/goals/goal-form-dialog";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type GoalSheetStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REWORK";

type GoalSheet = {
  id: string;
  status: GoalSheetStatus;
  reworkComment?: string | null;
  goals: Goal[];
  cycle: { id: string; name: string; year: number; isActive: boolean };
};

type ActiveCycle = {
  id: string;
  name: string;
  year: number;
  thrustAreas: ThrustArea[];
};

const STATUS_CONFIG: Record<
  GoalSheetStatus,
  { label: string; color: string; icon: React.ReactNode; description: string }
> = {
  DRAFT: {
    label: "Draft",
    color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    icon: <Clock className="h-4 w-4" />,
    description: "Your goal sheet is a draft. Add goals and submit when ready.",
  },
  SUBMITTED: {
    label: "Submitted",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    icon: <Send className="h-4 w-4" />,
    description: "Goal sheet submitted and awaiting manager review.",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    icon: <RefreshCw className="h-4 w-4" />,
    description: "Your manager is reviewing your goal sheet.",
  },
  APPROVED: {
    label: "Approved",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    icon: <CheckCircle2 className="h-4 w-4" />,
    description: "Goal sheet approved and locked. Quarterly check-ins are now active.",
  },
  REWORK: {
    label: "Returned for Rework",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    icon: <AlertCircle className="h-4 w-4" />,
    description: "Your manager returned this sheet with feedback. Please revise and resubmit.",
  },
};

export default function GoalsPageClient() {
  const [cycle, setCycle] = useState<ActiveCycle | null>(null);
  const [sheet, setSheet] = useState<GoalSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeCycle = await apiFetch<ActiveCycle | null>("/api/goals/active-cycle");
      if (!activeCycle) {
        setError("No active goal cycle found. Please contact your administrator.");
        return;
      }
      setCycle(activeCycle);

      const existingSheet = await apiFetch<GoalSheet | null>(`/api/goals/sheet/${activeCycle.id}`);
      setSheet(existingSheet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load goal data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateSheet() {
    if (!cycle) return;
    setCreatingSheet(true);
    try {
      const newSheet = await apiFetch<GoalSheet>("/api/goals/sheet", {
        method: "POST",
        body: JSON.stringify({ cycleId: cycle.id }),
      });
      setSheet(newSheet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create goal sheet");
    } finally {
      setCreatingSheet(false);
    }
  }

  async function handleSubmit() {
    if (!sheet) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/goals/sheet/${sheet.id}/submit`, { method: "POST" });
      setSheet((s) => (s ? { ...s, status: "SUBMITTED" } : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit goal sheet");
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoalAdded(goal: Goal) {
    setSheet((s) =>
      s
        ? {
            ...s,
            goals: editingGoal
              ? s.goals.map((g) => (g.id === goal.id ? goal : g))
              : [...s.goals, goal],
          }
        : s
    );
    setEditingGoal(null);
  }

  function handleGoalDeleted(goalId: string) {
    setSheet((s) => (s ? { ...s, goals: s.goals.filter((g) => g.id !== goalId) } : s));
  }

  const goals = sheet?.goals ?? [];
  const totalWeightage = goals.reduce((sum, goal) => sum + goal.weightage, 0);
  const isLocked = sheet ? !["DRAFT", "REWORK"].includes(sheet.status) : false;
  const canSubmit = !isLocked && totalWeightage === 100 && goals.length > 0 && !submitting;
  const statusCfg = sheet ? STATUS_CONFIG[sheet.status] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Goals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {cycle ? `${cycle.name} — FY ${cycle.year}` : "Goal Setting & Tracking"}
          </p>
        </div>

        {sheet && !isLocked && (
          <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2 shrink-0">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit for Review
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!cycle && !error && (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="font-medium">No active goal cycle</p>
            <p className="text-sm text-muted-foreground mt-1">
              Contact your administrator to open a new goal cycle.
            </p>
          </CardContent>
        </Card>
      )}

      {cycle && (
        <>
          {statusCfg && sheet && (
            <div className={cn("flex items-start gap-3 rounded-lg px-4 py-3 text-sm", statusCfg.color)}>
              {statusCfg.icon}
              <div>
                <p className="font-medium">{statusCfg.label}</p>
                <p className="opacity-80 mt-0.5">{statusCfg.description}</p>
                {sheet.status === "REWORK" && sheet.reworkComment && (
                  <div className="mt-2 rounded border border-current/20 bg-white/40 dark:bg-black/20 px-3 py-2">
                    <p className="font-medium text-xs mb-0.5">Manager feedback:</p>
                    <p className="text-xs">{sheet.reworkComment}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {!sheet && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Start Your Goal Sheet</CardTitle>
                <CardDescription>
                  Create your goal sheet for {cycle.name} to begin adding goals.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleCreateSheet} disabled={creatingSheet}>
                  {creatingSheet && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Goal Sheet
                </Button>
              </CardContent>
            </Card>
          )}

          {sheet && (
            <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">Goals</h2>
                    <Badge variant="secondary">{goals.length} / 8</Badge>
                  </div>
                  {!isLocked && goals.length < 8 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        setEditingGoal(null);
                        setFormOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Add Goal
                    </Button>
                  )}
                </div>

                <GoalList
                  goals={goals}
                  locked={isLocked}
                  onEdit={(goal) => {
                    setEditingGoal(goal);
                    setFormOpen(true);
                  }}
                  onDelete={handleGoalDeleted}
                />
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Weightage Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <WeightageBar total={Math.round(totalWeightage * 100) / 100} />
                    <Separator />
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">Submission rules</p>
                      {[
                        { ok: goals.length > 0, text: "At least 1 goal required" },
                        { ok: goals.length <= 8, text: "Maximum 8 goals" },
                        { ok: goals.every((g) => g.weightage >= 10), text: "Each goal ≥ 10% weight" },
                        { ok: Math.round(totalWeightage) === 100, text: "Total must equal 100%" },
                      ].map((rule) => (
                        <div key={rule.text} className="flex items-center gap-1.5">
                          <div className={cn("h-1.5 w-1.5 rounded-full", rule.ok ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                          <span className={rule.ok ? "text-foreground" : ""}>{rule.text}</span>
                        </div>
                      ))}
                    </div>

                    {!isLocked && (
                      <Button className="w-full gap-2" onClick={handleSubmit} disabled={!canSubmit}>
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Submit for Review
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Active Cycle</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p className="font-medium">{cycle.name}</p>
                    <p className="text-muted-foreground">FY {cycle.year}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {cycle.thrustAreas.length} thrust area{cycle.thrustAreas.length !== 1 ? "s" : ""} configured
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      {sheet && cycle && (
        <GoalFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          sheetId={sheet.id}
          thrustAreas={cycle.thrustAreas}
          editGoal={editingGoal}
          usedWeightage={totalWeightage - (editingGoal?.weightage ?? 0)}
          onSuccess={handleGoalAdded}
        />
      )}
    </div>
  );
}
