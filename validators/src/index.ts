import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const RoleSchema = z.enum(["EMPLOYEE", "MANAGER", "ADMIN"]);
export const GoalSheetStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REWORK",
]);
export const UomTypeSchema = z.enum([
  "NUMERIC_MIN",
  "NUMERIC_MAX",
  "TIMELINE",
  "ZERO",
]);
export const QuarterSchema = z.enum(["Q1", "Q2", "Q3", "Q4"]);
export const UpdateStatusSchema = z.enum([
  "NOT_STARTED",
  "ON_TRACK",
  "COMPLETED",
]);
export const EscalationTriggerSchema = z.enum([
  "GOAL_NOT_SUBMITTED",
  "GOAL_NOT_APPROVED",
  "CHECKIN_NOT_COMPLETED",
]);

// ─── Goal Validators ──────────────────────────────────────────────────────────

const CreateGoalBaseSchema = z.object({
    sheetId: z.string().cuid(),
    title: z.string().min(5, "Title must be at least 5 characters").max(200),
    description: z.string().max(1000).optional(),
    thrustAreaId: z.string().cuid("Please select a valid thrust area"),
    uomType: UomTypeSchema,
    targetValue: z.number().optional(),
    targetDate: z.coerce.date().optional(),
    weightage: z
      .number()
      .min(10, "Minimum weightage per goal is 10%")
      .max(100, "Weightage cannot exceed 100%"),
    sortOrder: z.number().int().optional(),
  });

export const CreateGoalSchema = CreateGoalBaseSchema.refine(
    (data) => {
      if (data.uomType === "TIMELINE") return !!data.targetDate;
      if (data.uomType === "ZERO") return true;
      return data.targetValue !== undefined && data.targetValue > 0;
    },
    {
      message:
        "Target value is required for Numeric UoM types; Target date is required for Timeline",
      path: ["targetValue"],
    }
  );

export const UpdateGoalSchema = CreateGoalBaseSchema.omit({ sheetId: true }).partial().refine(
    (data) => {
      if (!data.uomType) return true; // not updating uomType — skip
      if (data.uomType === "TIMELINE") return !!data.targetDate;
      if (data.uomType === "ZERO") return true;
      return data.targetValue !== undefined && data.targetValue > 0;
    },
    {
      message:
        "Target value is required for Numeric UoM types; Target date is required for Timeline",
      path: ["targetValue"],
    }
  );

export const GoalSheetSubmitSchema = z.object({
  sheetId: z.string().cuid(),
});

// ─── Goal Sheet Validators ────────────────────────────────────────────────────

export const ApproveSheetSchema = z.object({
  sheetId: z.string().cuid(),
});

export const ReturnSheetSchema = z.object({
  sheetId: z.string().cuid(),
  reworkComment: z
    .string()
    .min(10, "Please provide a detailed rework comment (min 10 characters)")
    .max(2000),
});

export const UnlockSheetSchema = z.object({
  sheetId: z.string().cuid(),
  reason: z
    .string()
    .min(10, "Please provide a reason for unlocking (min 10 characters)")
    .max(1000),
});

// ─── Quarterly Update Validators ──────────────────────────────────────────────

export const QuarterlyUpdateSchema = z
  .object({
    goalId: z.string().cuid(),
    quarter: QuarterSchema,
    actualValue: z.number().optional(),
    actualDate: z.coerce.date().optional(),
    status: UpdateStatusSchema,
  })
  .refine(
    (data) => {
      if (data.status !== "NOT_STARTED") {
        return data.actualValue !== undefined || data.actualDate !== undefined;
      }
      return true;
    },
    {
      message: "Actual value or date is required when status is not Not Started",
      path: ["actualValue"],
    }
  );

// ─── Check-in Validators ──────────────────────────────────────────────────────

export const CheckinSessionSchema = z.object({
  sheetId: z.string().cuid(),
  quarter: QuarterSchema,
  comment: z
    .string()
    .min(20, "Check-in comment must be at least 20 characters")
    .max(3000),
});

// ─── Shared Goals Validators ──────────────────────────────────────────────────

export const PushSharedGoalSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().max(1000).optional(),
  thrustAreaId: z.string().cuid(),
  uomType: UomTypeSchema,
  targetValue: z.number().optional(),
  targetDate: z.coerce.date().optional(),
  recipientUserIds: z
    .array(z.string().cuid())
    .min(1, "Select at least one recipient"),
  defaultWeightage: z
    .number()
    .min(10)
    .max(100)
    .optional()
    .default(10),
});

// ─── Cycle Validators ─────────────────────────────────────────────────────────

export const CreateCycleSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  name: z.string().min(2).max(100),
  goalSettingOpen: z.coerce.date().optional(),
  q1Open: z.coerce.date().optional(),
  q2Open: z.coerce.date().optional(),
  q3Open: z.coerce.date().optional(),
  q4Open: z.coerce.date().optional(),
  isActive: z.boolean().optional().default(false),
});

export const UpdateCycleSchema = CreateCycleSchema.partial();

// ─── User / Org Validators ───────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: RoleSchema,
  managerId: z.string().cuid().optional(),
  departmentId: z.string().cuid().optional(),
  password: z.string().min(8).optional(),
});

export const UpdateUserSchema = CreateUserSchema.partial().omit({
  password: true,
});

export const CreateDepartmentSchema = z.object({
  name: z.string().min(2).max(100),
  parentId: z.string().cuid().optional(),
});

// ─── Escalation Validators ───────────────────────────────────────────────────

export const CreateEscalationRuleSchema = z.object({
  cycleId: z.string().cuid(),
  triggerType: EscalationTriggerSchema,
  daysThreshold: z.number().int().min(1).max(90),
  active: z.boolean().optional().default(true),
});

// ─── Score Computation ───────────────────────────────────────────────────────

/**
 * Compute a 0–1 progress score for a goal.
 * For TIMELINE: partial credit decays linearly over a 30-day grace period.
 */
export function computeScore(
  uomType: "NUMERIC_MIN" | "NUMERIC_MAX" | "TIMELINE" | "ZERO",
  target: number | null | undefined,
  actual: number | null | undefined,
  targetDate?: Date | null,
  actualDate?: Date | null
): number {
  switch (uomType) {
    case "NUMERIC_MIN":
      if (!target || !actual) return 0;
      return Math.min(actual / target, 1);

    case "NUMERIC_MAX":
      if (!target || !actual || actual === 0) return 0;
      return Math.min(target / actual, 1);

    case "TIMELINE": {
      if (!targetDate || !actualDate) return 0;
      const deadline = targetDate.getTime();
      const completion = actualDate.getTime();
      if (completion <= deadline) return 1; // on time or early
      const gracePeriodMs = 30 * 24 * 60 * 60 * 1000; // 30 days
      const overdue = completion - deadline;
      return Math.max(0, 1 - overdue / gracePeriodMs);
    }

    case "ZERO":
      return actual === 0 ? 1 : 0;

    default:
      return 0;
  }
}

// ─── Weightage Validation Helper ──────────────────────────────────────────────

export function validateGoalWeightage(
  goals: Array<{ weightage: number }>
): { valid: boolean; total: number; error?: string } {
  const total = goals.reduce((sum, g) => sum + g.weightage, 0);
  const rounded = Math.round(total * 100) / 100;

  if (goals.length > 8) {
    return { valid: false, total: rounded, error: "Maximum 8 goals allowed per employee" };
  }
  if (goals.some((g) => g.weightage < 10)) {
    return { valid: false, total: rounded, error: "Each goal must have a minimum weightage of 10%" };
  }
  if (rounded !== 100) {
    return {
      valid: false,
      total: rounded,
      error: `Total weightage must equal 100%. Current total: ${rounded}%`,
    };
  }
  return { valid: true, total: rounded };
}

// ─── Type exports ─────────────────────────────────────────────────────────────

export type CreateGoalInput = z.infer<typeof CreateGoalSchema>;
export type UpdateGoalInput = z.infer<typeof UpdateGoalSchema>;
export type ReturnSheetInput = z.infer<typeof ReturnSheetSchema>;
export type QuarterlyUpdateInput = z.infer<typeof QuarterlyUpdateSchema>;
export type CheckinSessionInput = z.infer<typeof CheckinSessionSchema>;
export type PushSharedGoalInput = z.infer<typeof PushSharedGoalSchema>;
export type CreateCycleInput = z.infer<typeof CreateCycleSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type CreateEscalationRuleInput = z.infer<typeof CreateEscalationRuleSchema>;

