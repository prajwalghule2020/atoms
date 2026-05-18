"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  Save,
  TrendingUp,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
type UpdateStatus = "NOT_STARTED" | "ON_TRACK" | "COMPLETED";

type QuarterlyUpdate = {
  id: string;
  quarter: Quarter;
  actualValue?: number | null;
  actualDate?: string | null;
  status: UpdateStatus;
  computedScore: number | null;
};

type Goal = {
  id: string;
  title: string;
  description?: string | null;
  thrustArea: { name: string };
  uomType: "NUMERIC_MIN" | "NUMERIC_MAX" | "TIMELINE" | "ZERO";
  targetValue?: number | null;
  targetDate?: string | null;
  weightage: number;
  isShared: boolean;
  quarterlyUpdates: QuarterlyUpdate[];
};

type Sheet = {
  id: string;
  status: string;
  goals: Goal[];
};

type CheckinData = {
  cycle: { id: string; name: string; year: number } | null;
  sheet: Sheet | null;
  openQuarters: Quarter[];
};

// ─── Score display ────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40" :
    pct >= 50 ? "text-amber-700 bg-amber-100 dark:bg-amber-900/40" :
    "text-red-700 bg-red-100 dark:bg-red-900/40";
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", color)}>
      {pct}%
    </span>
  );
}

const STATUS_OPTS: { value: UpdateStatus; label: string }[] = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "ON_TRACK", label: "On Track" },
  { value: "COMPLETED", label: "Completed" },
];

const UOM_LABEL: Record<string, string> = {
  NUMERIC_MIN: "↑ Target (higher)",
  NUMERIC_MAX: "↓ Target (lower)",
  TIMELINE: "📅 Date target",
  ZERO: "0 Zero target",
};

// ─── Row state ────────────────────────────────────────────────────────────────

type RowDraft = {
  actualValue: string;
  actualDate: string;
  status: UpdateStatus;
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function CheckinsPageClient() {
  const [data, setData] = useState<CheckinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeQ, setActiveQ] = useState<Quarter | null>(null);

  // Per-goal draft state keyed by goalId
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    apiFetch<CheckinData>("/api/goals/checkins")
      .then((d) => {
        setData(d);
        if (d.openQuarters.length > 0) setActiveQ(d.openQuarters[d.openQuarters.length - 1] as Quarter);
        // Seed drafts from existing updates
        if (d.sheet) {
          const initial: Record<string, RowDraft> = {};
          for (const goal of d.sheet.goals) {
            for (const upd of goal.quarterlyUpdates) {
              initial[`${goal.id}_${upd.quarter}`] = {
                actualValue: upd.actualValue?.toString() ?? "",
                actualDate: upd.actualDate ? upd.actualDate.slice(0, 10) : "",
                status: upd.status,
              };
            }
          }
          setDrafts(initial);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function getDraft(goalId: string, q: Quarter): RowDraft {
    return drafts[`${goalId}_${q}`] ?? { actualValue: "", actualDate: "", status: "NOT_STARTED" };
  }

  function setDraft(goalId: string, q: Quarter, patch: Partial<RowDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [`${goalId}_${q}`]: { ...getDraft(goalId, q), ...patch },
    }));
  }

  function getExisting(goal: Goal, q: Quarter): QuarterlyUpdate | undefined {
    return goal.quarterlyUpdates.find((u) => u.quarter === q);
  }

  async function saveRow(goal: Goal, q: Quarter) {
    const key = `${goal.id}_${q}`;
    const draft = getDraft(goal.id, q);
    setSaving((p) => ({ ...p, [key]: true }));
    setRowErrors((p) => ({ ...p, [key]: "" }));

    const body: Record<string, unknown> = { status: draft.status };

    if (goal.uomType === "TIMELINE") {
      if (!draft.actualDate) {
        setRowErrors((p) => ({ ...p, [key]: "Please enter an actual completion date" }));
        setSaving((p) => ({ ...p, [key]: false }));
        return;
      }
      body.actualDate = draft.actualDate;
    } else if (goal.uomType !== "ZERO") {
      if (!draft.actualValue) {
        setRowErrors((p) => ({ ...p, [key]: "Please enter an actual value" }));
        setSaving((p) => ({ ...p, [key]: false }));
        return;
      }
      body.actualValue = parseFloat(draft.actualValue);
    }

    try {
      const result = await apiFetch<QuarterlyUpdate & { computedScore: number }>(
        `/api/goals/${goal.id}/update/${q}`,
        { method: "POST", body: JSON.stringify(body) }
      );
      // Update local data
      setData((prev) => {
        if (!prev?.sheet) return prev;
        return {
          ...prev,
          sheet: {
            ...prev.sheet,
            goals: prev.sheet.goals.map((g) => {
              if (g.id !== goal.id) return g;
              const existing = g.quarterlyUpdates.find((u) => u.quarter === q);
              return {
                ...g,
                quarterlyUpdates: existing
                  ? g.quarterlyUpdates.map((u) => (u.quarter === q ? { ...u, ...result } : u))
                  : [...g.quarterlyUpdates, result],
              };
            }),
          },
        };
      });
      setSaved((p) => ({ ...p, [key]: true }));
      setTimeout(() => setSaved((p) => ({ ...p, [key]: false })), 2000);
    } catch (e) {
      setRowErrors((p) => ({
        ...p,
        [key]: e instanceof Error ? e.message : "Failed to save",
      }));
    } finally {
      setSaving((p) => ({ ...p, [key]: false }));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sheet = data?.sheet;
  const openQuarters = data?.openQuarters ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quarterly Check-ins</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data?.cycle
            ? `${data.cycle.name} · FY ${data.cycle.year}`
            : "No active cycle"}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* No approved sheet */}
      {!sheet || sheet.status !== "APPROVED" ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium text-lg">Goal sheet not yet approved</p>
            <p className="text-sm text-muted-foreground mt-1">
              Quarterly check-ins are only available once your manager has approved your goal sheet.
            </p>
          </CardContent>
        </Card>
      ) : openQuarters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium text-lg">No quarter open yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your administrator hasn&apos;t opened any check-in window yet. Check back later.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Quarter selector */}
          <div className="flex items-center gap-2 flex-wrap">
            {(["Q1", "Q2", "Q3", "Q4"] as Quarter[]).map((q) => {
              const isOpen = openQuarters.includes(q);
              return (
                <button
                  key={q}
                  onClick={() => isOpen && setActiveQ(q)}
                  disabled={!isOpen}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    activeQ === q
                      ? "bg-primary text-primary-foreground"
                      : isOpen
                        ? "bg-muted text-foreground hover:bg-muted/80"
                        : "bg-muted/40 text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {q}
                  {!isOpen && <Lock className="inline h-3 w-3 ml-1.5 opacity-60" />}
                </button>
              );
            })}
          </div>

          {activeQ && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {activeQ} Actuals
                </CardTitle>
                <CardDescription>
                  Enter your actual achievement for each goal. Scores are computed automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {sheet.goals.map((goal, idx) => {
                    const key = `${goal.id}_${activeQ}`;
                    const draft = getDraft(goal.id, activeQ);
                    const existing = getExisting(goal, activeQ);

                    return (
                      <div key={goal.id} className="px-6 py-4 space-y-3">
                        {/* Goal title row */}
                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold mt-0.5">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">{goal.title}</p>
                              <Badge variant="outline" className="text-xs">{goal.thrustArea.name}</Badge>
                              {goal.isShared && (
                                <Badge variant="secondary" className="text-xs">Shared</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {UOM_LABEL[goal.uomType]}
                              {goal.targetValue !== undefined && goal.targetValue !== null
                                ? ` · Target: ${goal.targetValue}`
                                : ""}
                              {goal.targetDate
                                ? ` · By: ${new Date(goal.targetDate).toLocaleDateString()}`
                                : ""}
                              {" · "}<strong>{goal.weightage}% weight</strong>
                            </p>
                          </div>
                          {/* Score */}
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <ScoreBadge score={existing?.computedScore ?? null} />
                            <span className="text-[10px] text-muted-foreground">score</span>
                          </div>
                        </div>

                        {/* Input row */}
                        <div className="flex items-end gap-3 flex-wrap pl-9">
                          {/* Actual input */}
                          {goal.uomType === "TIMELINE" ? (
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-muted-foreground">Actual Completion Date</label>
                              <Input
                                type="date"
                                className="w-44 h-8 text-sm"
                                value={draft.actualDate}
                                onChange={(e) => setDraft(goal.id, activeQ, { actualDate: e.target.value })}
                              />
                            </div>
                          ) : goal.uomType !== "ZERO" ? (
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-muted-foreground">Actual Value</label>
                              <Input
                                type="number"
                                className="w-36 h-8 text-sm"
                                placeholder={goal.targetValue?.toString() ?? "0"}
                                value={draft.actualValue}
                                onChange={(e) => setDraft(goal.id, activeQ, { actualValue: e.target.value })}
                              />
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground self-end pb-1">Zero-target: mark status below</p>
                          )}

                          {/* Status */}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Status</label>
                            <Select
                              value={draft.status}
                              onValueChange={(v) => setDraft(goal.id, activeQ, { status: v as UpdateStatus })}
                            >
                              <SelectTrigger className="w-38 h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Save button */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5"
                            onClick={() => saveRow(goal, activeQ)}
                            disabled={saving[key]}
                          >
                            {saving[key] ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : saved[key] ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            {saved[key] ? "Saved!" : "Save"}
                          </Button>
                        </div>

                        {rowErrors[key] && (
                          <p className="pl-9 text-xs text-destructive">{rowErrors[key]}</p>
                        )}
                        <Separator className="mt-1" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
