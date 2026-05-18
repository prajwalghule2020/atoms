import { prisma } from "@repo/db";

type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

const QUARTER_FIELD_MAP: Record<Quarter, "q1Open" | "q2Open" | "q3Open" | "q4Open"> = {
  Q1: "q1Open",
  Q2: "q2Open",
  Q3: "q3Open",
  Q4: "q4Open",
};

export async function getOpenQuarters(): Promise<Quarter[]> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return [];

  const now = new Date();
  return (['Q1', 'Q2', 'Q3', 'Q4'] as Quarter[]).filter((quarter) => {
    const field = QUARTER_FIELD_MAP[quarter];
    const openDate = cycle[field] as Date | null;
    return openDate !== null && now >= openDate;
  });
}
