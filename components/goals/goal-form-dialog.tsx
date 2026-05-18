"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThrustArea = { id: string; name: string };

export type Goal = {
  id: string;
  sheetId: string;
  title: string;
  description?: string | null;
  thrustAreaId: string;
  thrustArea: ThrustArea;
  uomType: "NUMERIC_MIN" | "NUMERIC_MAX" | "TIMELINE" | "ZERO";
  targetValue?: number | null;
  targetDate?: string | null;
  weightage: number;
  sortOrder: number;
  isShared: boolean;
};

// ─── Schema (client-side, matches server CreateGoalSchema) ───────────────────

const formSchema = z
  .object({
    title: z.string().min(5, "Title must be at least 5 characters").max(200),
    description: z.string().max(1000).optional(),
    thrustAreaId: z.string().min(1, "Please select a thrust area"),
    uomType: z.enum(["NUMERIC_MIN", "NUMERIC_MAX", "TIMELINE", "ZERO"]),
    targetValue: z.coerce.number().optional(),
    targetDate: z.string().optional(),
    weightage: z.coerce
      .number({ invalid_type_error: "Enter a number" })
      .min(10, "Minimum 10%")
      .max(100, "Maximum 100%"),
  })
  .refine(
    (d) => {
      if (d.uomType === "TIMELINE") return !!d.targetDate;
      if (d.uomType === "ZERO") return true;
      return d.targetValue !== undefined && d.targetValue > 0;
    },
    {
      message: "Target value / date is required for this UoM type",
      path: ["targetValue"],
    }
  );

type FormValues = z.infer<typeof formSchema>;

// ─── UoM helpers ─────────────────────────────────────────────────────────────

const UOM_OPTIONS = [
  { value: "NUMERIC_MIN", label: "Numeric (Higher is better)", hint: "e.g. Revenue, Customer satisfaction" },
  { value: "NUMERIC_MAX", label: "Numeric (Lower is better)", hint: "e.g. TAT, Error rate, Cost" },
  { value: "TIMELINE", label: "Timeline (Date-based)", hint: "e.g. Project launch, Milestone completion" },
  { value: "ZERO", label: "Zero Target", hint: "e.g. Safety incidents, Defects (zero = success)" },
] as const;

const STEPS = ["Thrust Area", "Goal Details", "Target & Weight"];

// ─── Props ────────────────────────────────────────────────────────────────────

interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetId: string;
  thrustAreas: ThrustArea[];
  editGoal?: Goal | null;
  usedWeightage: number;
  onSuccess: (goal: Goal) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GoalFormDialog({
  open,
  onOpenChange,
  sheetId,
  thrustAreas,
  editGoal,
  usedWeightage,
  onSuccess,
}: GoalFormDialogProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!editGoal;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: editGoal?.title ?? "",
      description: editGoal?.description ?? "",
      thrustAreaId: editGoal?.thrustAreaId ?? "",
      uomType: editGoal?.uomType ?? "NUMERIC_MIN",
      targetValue: editGoal?.targetValue ?? undefined,
      targetDate: editGoal?.targetDate
        ? editGoal.targetDate.slice(0, 10)
        : undefined,
      weightage: editGoal?.weightage ?? 10,
    },
  });

  const uomType = form.watch("uomType");

  // Available weightage: 100 minus what's already used, plus the current goal's own weightage if editing
  const availableWeightage =
    100 - usedWeightage + (editGoal?.weightage ?? 0);

  async function handleSubmit(values: FormValues) {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...values,
        sheetId,
        targetDate: values.targetDate ? new Date(values.targetDate) : undefined,
        targetValue:
          values.uomType === "ZERO" || values.uomType === "TIMELINE"
            ? undefined
            : values.targetValue,
      };

      let goal: Goal;
      if (isEdit) {
        goal = await apiFetch<Goal>(`/api/goals/${editGoal!.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        goal = await apiFetch<Goal>("/api/goals", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      onSuccess(goal);
      onOpenChange(false);
      form.reset();
      setStep(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    onOpenChange(false);
    form.reset();
    setStep(0);
    setError(null);
  }

  async function nextStep() {
    // Validate fields for current step before proceeding
    const stepFields: Array<keyof FormValues>[] = [
      ["thrustAreaId"],
      ["title", "description", "uomType"],
      ["targetValue", "targetDate", "weightage"],
    ];
    const valid = await form.trigger(stepFields[step]);
    if (valid) setStep((s) => s + 1);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Goal" : "Add Goal"}</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex gap-1.5 mb-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {/* ── Step 0: Thrust Area ── */}
            {step === 0 && (
              <FormField
                control={form.control}
                name="thrustAreaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Thrust Area</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a thrust area…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {thrustAreas.map((ta) => (
                          <SelectItem key={ta.id} value={ta.id}>
                            {ta.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* ── Step 1: Goal details ── */}
            {step === 1 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goal Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Increase quarterly revenue by 15%"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Description {" "}
                        <span className="text-muted-foreground text-xs">
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe how you'll achieve this goal…"
                          className="resize-none h-20"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="uomType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit of Measure</FormLabel>
                      <div className="grid grid-cols-1 gap-2">
                        {UOM_OPTIONS.map((opt) => (
                          <button
                            type="button"
                            key={opt.value}
                            onClick={() => field.onChange(opt.value)}
                            className={cn(
                              "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                              field.value === opt.value
                                ? "border-primary bg-primary/5"
                                : "border-border"
                            )}
                          >
                            <div
                              className={cn(
                                "mt-0.5 h-4 w-4 rounded-full border-2 shrink-0",
                                field.value === opt.value
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground"
                              )}
                            />
                            <div>
                              <p className="text-sm font-medium">
                                {opt.label}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {opt.hint}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* ── Step 2: Target & Weightage ── */}
            {step === 2 && (
              <div className="space-y-4">
                {uomType === "TIMELINE" ? (
                  <FormField
                    control={form.control}
                    name="targetDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Completion Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : uomType === "ZERO" ? (
                  <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="mb-1">
                      Zero Target
                    </Badge>
                    <p>
                      No target value needed — success is measured by achieving
                      zero occurrences.
                    </p>
                  </div>
                ) : (
                  <FormField
                    control={form.control}
                    name="targetValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Target Value {" "}
                          <span className="text-muted-foreground text-xs">
                            ({uomType === "NUMERIC_MIN" ? "higher is better" : "lower is better"})
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            placeholder="Enter your target…"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="weightage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Weightage {" "}
                        <span className="text-muted-foreground text-xs">
                          (max available: {availableWeightage}%)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={10}
                          max={availableWeightage}
                          step={5}
                          placeholder="e.g. 30"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                {error}
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              {step > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((s) => s - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={nextStep}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEdit ? "Save Changes" : "Add Goal"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
