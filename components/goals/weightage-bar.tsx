"use client";

import { cn } from "@/lib/utils";

interface WeightageBarProps {
  total: number;
  className?: string;
}

export function WeightageBar({ total, className }: WeightageBarProps) {
  const pct = Math.min(total, 100);
  const isOver = total > 100;
  const isComplete = total === 100;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">Total Weightage</span>
        <span
          className={cn(
            "font-bold tabular-nums",
            isOver && "text-destructive",
            isComplete && "text-emerald-600 dark:text-emerald-400",
            !isOver && !isComplete && "text-muted-foreground"
          )}
        >
          {total}%
        </span>
      </div>

      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isOver && "bg-destructive",
            isComplete && "bg-emerald-500",
            !isOver && !isComplete && "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {isComplete
            ? "✓ Ready to submit"
            : isOver
              ? `${total - 100}% over limit`
              : `${100 - total}% remaining`}
        </span>
        <span>100% required</span>
      </div>
    </div>
  );
}
