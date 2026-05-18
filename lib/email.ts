import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "dummy_key_to_prevent_crash");
const FROM = process.env.EMAIL_FROM ?? "Atoms Portal <noreply@atomsportal.dev>";

function baseTemplate(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .header { background: #1e293b; padding: 24px 32px; }
    .header h1 { margin: 0; color: #f8fafc; font-size: 18px; font-weight: 600; letter-spacing: -.02em; }
    .header span { color: #94a3b8; font-size: 13px; }
    .body { padding: 28px 32px; color: #334155; font-size: 14px; line-height: 1.65; }
    .body h2 { margin: 0 0 12px; font-size: 16px; color: #0f172a; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-blue { background: #dbeafe; color: #1d4ed8; }
    .badge-green { background: #dcfce7; color: #16a34a; }
    .badge-amber { background: #fef3c7; color: #d97706; }
    .badge-red { background: #fee2e2; color: #dc2626; }
    .cta { display: inline-block; margin: 20px 0 8px; padding: 10px 20px; background: #1e293b; color: #fff !important; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; }
    .footer { padding: 16px 32px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
    p { margin: 0 0 12px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>⚛ Atoms Performance Portal</h1>
      <span>Automated notification</span>
    </div>
    <div class="body">${body}</div>
    <div class="footer">This is an automated message from the Atoms Performance Portal. Please do not reply.</div>
  </div>
</body>
</html>`;
}

async function send(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL SKIP — no RESEND_API_KEY] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("[EMAIL ERROR]", err);
  }
}

export async function sendGoalSubmittedEmail(opts: {
  managerEmail: string;
  managerName: string;
  employeeName: string;
  sheetId: string;
  cycleName: string;
}) {
  const html = baseTemplate(
    "New Goal Sheet Awaiting Review",
    `<h2>Goal Sheet Submitted for Review</h2>
    <p>Hi <strong>${opts.managerName}</strong>,</p>
    <p><strong>${opts.employeeName}</strong> has submitted their goal sheet for the <span class="badge badge-blue">${opts.cycleName}</span> cycle and it is awaiting your approval.</p>
    <a class="cta" href="${process.env.FRONTEND_URL}/manager/approvals">Review Goal Sheet →</a>
    <p>Please review and approve or return for rework within the required window.</p>`
  );
  await send(opts.managerEmail, `Goal sheet submitted by ${opts.employeeName} — action required`, html);
}

export async function sendGoalApprovedEmail(opts: {
  employeeEmail: string;
  employeeName: string;
  managerName: string;
  cycleName: string;
}) {
  const html = baseTemplate(
    "Your Goal Sheet Has Been Approved",
    `<h2>Goal Sheet Approved ✓</h2>
    <p>Hi <strong>${opts.employeeName}</strong>,</p>
    <p>Great news! Your goal sheet for the <span class="badge badge-green">${opts.cycleName}</span> cycle has been <strong>approved</strong> by <strong>${opts.managerName}</strong>.</p>
    <a class="cta" href="${process.env.FRONTEND_URL}/dashboard/goals">View Your Goals →</a>
    <p>Your goals are now locked. You can log your quarterly actuals once the check-in window opens.</p>`
  );
  await send(opts.employeeEmail, "Your goal sheet has been approved", html);
}

export async function sendGoalReturnedEmail(opts: {
  employeeEmail: string;
  employeeName: string;
  managerName: string;
  cycleName: string;
  reworkComment: string;
}) {
  const html = baseTemplate(
    "Goal Sheet Returned for Revision",
    `<h2>Goal Sheet Returned for Rework</h2>
    <p>Hi <strong>${opts.employeeName}</strong>,</p>
    <p>Your goal sheet for the <span class="badge badge-amber">${opts.cycleName}</span> cycle has been <strong>returned for revision</strong> by <strong>${opts.managerName}</strong>.</p>
    <div style="margin:16px 0;padding:14px 16px;background:#fef3c7;border-left:3px solid #d97706;border-radius:6px;font-size:13px;color:#92400e;">
      <strong>Manager's comment:</strong><br/>${opts.reworkComment}
    </div>
    <a class="cta" href="${process.env.FRONTEND_URL}/dashboard/goals">Revise Your Goals →</a>
    <p>Please update your goals and resubmit at your earliest convenience.</p>`
  );
  await send(opts.employeeEmail, "Your goal sheet has been returned for revision", html);
}

export async function sendCheckinWindowEmail(opts: {
  recipientEmail: string;
  recipientName: string;
  quarter: string;
  cycleName: string;
  role: "EMPLOYEE" | "MANAGER";
}) {
  const link = opts.role === "MANAGER"
    ? `${process.env.FRONTEND_URL}/manager/checkins`
    : `${process.env.FRONTEND_URL}/dashboard/checkins`;

  const html = baseTemplate(
    `${opts.quarter} Check-in Window Now Open`,
    `<h2>${opts.quarter} Check-in Window is Now Open</h2>
    <p>Hi <strong>${opts.recipientName}</strong>,</p>
    <p>The <span class="badge badge-blue">${opts.quarter}</span> check-in window for the <strong>${opts.cycleName}</strong> cycle is now open.</p>
    ${opts.role === "EMPLOYEE"
      ? `<p>Please log your quarterly actuals for all your goals before the window closes.</p>`
      : `<p>Please conduct check-in conversations with your team and record your structured check-in notes.</p>`
    }
    <a class="cta" href="${link}">${opts.role === "EMPLOYEE" ? "Log Quarterly Actuals →" : "Go to Team Check-ins →"}</a>`
  );
  await send(
    opts.recipientEmail,
    `${opts.quarter} check-in window is now open — ${opts.cycleName}`,
    html
  );
}

export async function sendEscalationEmail(opts: {
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  ctaText: string;
  ctaLink: string;
  severity: "warning" | "critical";
}) {
  const badgeClass = opts.severity === "critical" ? "badge-red" : "badge-amber";
  const badgeLabel = opts.severity === "critical" ? "CRITICAL" : "WARNING";

  const html = baseTemplate(
    opts.subject,
    `<h2><span class="badge ${badgeClass}">${badgeLabel}</span> Escalation Notice</h2>
    <p>Hi <strong>${opts.recipientName}</strong>,</p>
    <p>${opts.body}</p>
    <a class="cta" href="${opts.ctaLink}">${opts.ctaText}</a>
    <p style="font-size:12px;color:#64748b;margin-top:20px;">This is an automated escalation triggered by a rule configured for your organization. Contact your HR admin if you believe this is in error.</p>`
  );
  await send(opts.recipientEmail, opts.subject, html);
}
