"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, MoreVertical, Pencil, Trash2, Lock, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import type { Goal } from "./goal-form-dialog";

// ─── UoM label helpers ────────────────────────────────────────────────────────

const UOM_LABELS: Record<string, string> = {
  NUMERIC_MIN: "↑ Higher",
  NUMERIC_MAX: "↓ Lower",
  TIMELINE: "📅 Date",
  ZERO: "0 Zero",
};

const UOM_COLORS: Record<string, string> = {
  NUMERIC_MIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  NUMERIC_MAX: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  TIMELINE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  ZERO: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface GoalListProps {
  goals: Goal[];
  locked: boolean;
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GoalList({ goals, locked, onEdit, onDelete }: GoalListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(goal: Goal) {
    if (!confirm(`Delete "${goal.title}"? This cannot be undone.`)) return;
    setDeletingId(goal.id);
    try {
      await apiFetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      onDelete(goal.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete goal");
    } finally {
      setDeletingId(null);
    }
  }

  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted py-16 text-center">
        <div className="text-4xl mb-3">🎯</div>
        <p className="font-medium text-muted-foreground">No goals yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Add your first goal to get started
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {goals.map((goal, idx) => (
          <Card
            key={goal.id}
            className={cn(
              "transition-shadow hover:shadow-md",
              goal.isShared && "border-dashed"
            )}
          >
            <CardContent className="flex items-start gap-4 py-4">
              {/* Number */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                {idx + 1}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm leading-snug truncate">
                        {goal.title}
                      </p>
                      {goal.isShared && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="secondary" className="gap-1 text-xs shrink-0">
                              <Share2 className="h-3 w-3" />
                              Shared
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Assigned by manager — title and target are locked
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {goal.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {goal.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {!locked && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          disabled={deletingId === goal.id}
                        >
                          {deletingId === goal.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MoreVertical className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(goal)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Edit
                        </DropdownMenuItem>
                        {!goal.isShared && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(goal)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {locked && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent>Sheet is locked</TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-xs py-0">
                    {goal.thrustArea.name}
                  </Badge>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      UOM_COLORS[goal.uomType]
                    )}
                  >
                    {UOM_LABELS[goal.uomType]}
                  </span>
                  {(goal.targetValue !== null && goal.targetValue !== undefined) && (
                    <span className="text-xs text-muted-foreground">
                      Target: {goal.targetValue}
                    </span>
                  )}
                  {goal.targetDate && (
                    <span className="text-xs text-muted-foreground">
                      By: {new Date(goal.targetDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Weightage pill */}
              <div className="shrink-0 flex flex-col items-center justify-center rounded-lg bg-muted px-3 py-1.5 min-w-[56px]">
                <span className="text-base font-bold tabular-nums leading-none">
                  {goal.weightage}%
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  weight
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}
