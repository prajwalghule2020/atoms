import { NextResponse } from "next/server";
import { authorize } from "@/lib/server-auth";
import { prisma } from "@repo/db";
import ExcelJS from "exceljs";

export async function GET(request: Request) {
  const result = await authorize(request);
  if ("response" in result) return result.response;

  if (result.user.role !== "ADMIN" && result.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const cycle = await prisma.cycle.findFirst({
      where: { isActive: true },
    });

    if (!cycle) {
      return NextResponse.json({ error: "No active cycle" }, { status: 400 });
    }

    const goalSheets = await prisma.goalSheet.findMany({
      where: { cycleId: cycle.id },
      include: {
        user: {
          include: { department: true, manager: true }
        },
        goals: {
          include: {
            thrustArea: true,
            quarterlyUpdates: true,
          }
        }
      }
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AtomQuest System";
    const worksheet = workbook.addWorksheet(`Goals_Report_${cycle.year}`);

    worksheet.columns = [
      { header: 'Employee Name', key: 'name', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Manager', key: 'manager', width: 20 },
      { header: 'Sheet Status', key: 'sheetStatus', width: 15 },
      { header: 'Goal Title', key: 'goalTitle', width: 30 },
      { header: 'Thrust Area', key: 'thrustArea', width: 20 },
      { header: 'UoM', key: 'uom', width: 15 },
      { header: 'Weightage', key: 'weightage', width: 10 },
      { header: 'Target Value', key: 'targetValue', width: 15 },
      { header: 'Target Date', key: 'targetDate', width: 15 },
      { header: 'Q1 Status', key: 'q1Status', width: 15 },
      { header: 'Q1 Score', key: 'q1Score', width: 10 },
      { header: 'Q2 Status', key: 'q2Status', width: 15 },
      { header: 'Q2 Score', key: 'q2Score', width: 10 },
      { header: 'Q3 Status', key: 'q3Status', width: 15 },
      { header: 'Q3 Score', key: 'q3Score', width: 10 },
      { header: 'Q4 Status', key: 'q4Status', width: 15 },
      { header: 'Q4 Score', key: 'q4Score', width: 10 },
    ];

    // Format headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    goalSheets.forEach(sheet => {
      if (sheet.goals.length === 0) {
        worksheet.addRow({
          name: sheet.user.name,
          email: sheet.user.email,
          department: sheet.user.department?.name || 'N/A',
          manager: sheet.user.manager?.name || 'N/A',
          sheetStatus: sheet.status,
          goalTitle: 'No Goals Defined'
        });
      } else {
        sheet.goals.forEach(goal => {
          const q1 = goal.quarterlyUpdates.find(q => q.quarter === "Q1");
          const q2 = goal.quarterlyUpdates.find(q => q.quarter === "Q2");
          const q3 = goal.quarterlyUpdates.find(q => q.quarter === "Q3");
          const q4 = goal.quarterlyUpdates.find(q => q.quarter === "Q4");

          worksheet.addRow({
            name: sheet.user.name,
            email: sheet.user.email,
            department: sheet.user.department?.name || 'N/A',
            manager: sheet.user.manager?.name || 'N/A',
            sheetStatus: sheet.status,
            goalTitle: goal.title,
            thrustArea: goal.thrustArea.name,
            uom: goal.uomType,
            weightage: `${goal.weightage}%`,
            targetValue: goal.targetValue || 'N/A',
            targetDate: goal.targetDate ? goal.targetDate.toISOString().split('T')[0] : 'N/A',
            q1Status: q1?.status || 'NOT_STARTED',
            q1Score: q1?.computedScore !== null && q1?.computedScore !== undefined ? (q1.computedScore * 100).toFixed(1) + '%' : 'N/A',
            q2Status: q2?.status || 'NOT_STARTED',
            q2Score: q2?.computedScore !== null && q2?.computedScore !== undefined ? (q2.computedScore * 100).toFixed(1) + '%' : 'N/A',
            q3Status: q3?.status || 'NOT_STARTED',
            q3Score: q3?.computedScore !== null && q3?.computedScore !== undefined ? (q3.computedScore * 100).toFixed(1) + '%' : 'N/A',
            q4Status: q4?.status || 'NOT_STARTED',
            q4Score: q4?.computedScore !== null && q4?.computedScore !== undefined ? (q4.computedScore * 100).toFixed(1) + '%' : 'N/A',
          });
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Goal_Achievement_Report_${cycle.year}.xlsx"`,
      }
    });

  } catch (err) {
    console.error("Export error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
