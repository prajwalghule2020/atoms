const WEBHOOK = process.env.TEAMS_WEBHOOK_URL;

type CardPayload = {
  title: string;
  text: string;
  facts: { name: string; value: string }[];
  actionUrl?: string;
  actionTitle?: string;
  themeColor?: string;
};

async function postCard(payload: CardPayload) {
  if (!WEBHOOK) {
    console.log("[TEAMS SKIP — no TEAMS_WEBHOOK_URL]", payload.title);
    return;
  }

  const body = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: payload.themeColor ?? "0078D4",
    summary: payload.title,
    sections: [
      {
        activityTitle: `⚛ **${payload.title}**`,
        activitySubtitle: "Atoms Performance Portal",
        activityText: payload.text,
        facts: payload.facts,
      },
    ],
    ...(payload.actionUrl
      ? {
          potentialAction: [
            {
              "@type": "OpenUri",
              name: payload.actionTitle ?? "Open Portal",
              targets: [{ os: "default", uri: payload.actionUrl }],
            },
          ],
        }
      : {}),
  };

  try {
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Teams webhook responded with ${res.status}`);
  } catch (err) {
    console.error("[TEAMS WEBHOOK ERROR]", err);
  }
}

export async function teamsGoalSubmitted(opts: {
  employeeName: string;
  managerName: string;
  cycleName: string;
  sheetId: string;
}) {
  await postCard({
    title: "Goal Sheet Submitted for Review",
    text: `**${opts.employeeName}** has submitted their goal sheet for **${opts.cycleName}** and it is awaiting review.`,
    facts: [
      { name: "Employee", value: opts.employeeName },
      { name: "Manager", value: opts.managerName },
      { name: "Cycle", value: opts.cycleName },
      { name: "Status", value: "SUBMITTED — Awaiting Approval" },
    ],
    actionUrl: `${process.env.FRONTEND_URL}/manager/approvals`,
    actionTitle: "Review Goal Sheet",
    themeColor: "0078D4",
  });
}

export async function teamsGoalApproved(opts: {
  employeeName: string;
  managerName: string;
  cycleName: string;
}) {
  await postCard({
    title: "Goal Sheet Approved",
    text: `**${opts.managerName}** has approved **${opts.employeeName}'s** goal sheet for **${opts.cycleName}**.`,
    facts: [
      { name: "Employee", value: opts.employeeName },
      { name: "Approver", value: opts.managerName },
      { name: "Cycle", value: opts.cycleName },
      { name: "Status", value: "✅ APPROVED" },
    ],
    actionUrl: `${process.env.FRONTEND_URL}/manager/dashboard`,
    actionTitle: "View Team Dashboard",
    themeColor: "107C10",
  });
}

export async function teamsGoalReturned(opts: {
  employeeName: string;
  managerName: string;
  cycleName: string;
  reworkComment: string;
}) {
  await postCard({
    title: "Goal Sheet Returned for Revision",
    text: `**${opts.managerName}** has returned **${opts.employeeName}'s** goal sheet for revision.`,
    facts: [
      { name: "Employee", value: opts.employeeName },
      { name: "Returned by", value: opts.managerName },
      { name: "Cycle", value: opts.cycleName },
      { name: "Comment", value: opts.reworkComment.slice(0, 120) + (opts.reworkComment.length > 120 ? "…" : "") },
    ],
    actionUrl: `${process.env.FRONTEND_URL}/dashboard/goals`,
    actionTitle: "Revise Goals",
    themeColor: "D83B01",
  });
}

export async function teamsEscalation(opts: {
  employeeName: string;
  triggerType: string;
  daysOverdue: number;
  cycleName: string;
}) {
  await postCard({
    title: "Escalation Alert",
    text: `An escalation has been triggered for **${opts.employeeName}** — **${opts.triggerType.replace(/_/g, " ")}** after ${opts.daysOverdue} days.`,
    facts: [
      { name: "Employee", value: opts.employeeName },
      { name: "Trigger", value: opts.triggerType.replace(/_/g, " ") },
      { name: "Days Overdue", value: String(opts.daysOverdue) },
      { name: "Cycle", value: opts.cycleName },
    ],
    actionUrl: `${process.env.FRONTEND_URL}/admin/dashboard`,
    actionTitle: "View Admin Dashboard",
    themeColor: "FFC300",
  });
}
