// Portal team invite email. Table layout + inline styles for Outlook/Gmail. Matches the other portal emails.

const LOGO_URL = "https://console.ubfreight.com/email/ubf-logo.png";
const NAVY = "#0A2472";
const ORANGE = "#F7941D";
const INK = "#1E293B";
const BODY = "#475569";
const MUTED = "#94A3B8";
const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const title = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Ltd|Nz)\b/g, (m) => m.toUpperCase());

export function inviteEmail(o: { inviter: string; company: string | null; name: string | null; link: string }): { subject: string; html: string; text: string } {
  const company = o.company ? title(o.company) : "your company";
  const subject = `${o.inviter} invited you to the UB Freight portal`;
  const hello = o.name ? `Hi ${o.name.split(/\s+/)[0]},` : "Hello,";
  const lines = [
    `${o.inviter} has invited you to ${company}'s account on the UB Freight customer portal.`,
    "Track shipments live, see invoices, request bookings and get rates in one place.",
    "Set a password to get started. This link works once and expires in 7 days.",
  ];
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F1F4F9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(lines[0])}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F4F9;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="background:${NAVY};height:4px;line-height:4px;font-size:0;border-radius:12px 12px 0 0;">&nbsp;</td></tr>
<tr><td style="background:#ffffff;padding:28px 36px 30px;border-radius:0 0 12px 12px;">
<img src="${LOGO_URL}" width="96" height="47" alt="UB Freight" style="display:block;border:0;width:96px;height:47px;">
<p style="margin:22px 0 8px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${ORANGE};">Portal invite</p>
<h1 style="margin:0 0 18px;font-family:${FONT};font-size:22px;line-height:30px;font-weight:600;color:${INK};">You're invited to ${esc(company)} on UB Freight</h1>
<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:23px;color:${BODY};">${esc(hello)}</p>
${lines.map((l) => `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:23px;color:${BODY};">${esc(l)}</p>`).join("")}
<p style="margin:22px 0 22px;"><a href="${esc(o.link)}" target="_blank" style="display:inline-block;background:${NAVY};color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;line-height:46px;height:46px;padding:0 28px;border-radius:8px;text-decoration:none;">Set your password</a></p>
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">Didn't expect this? Ignore this email and nothing happens. Reply to reach ${esc(o.inviter)}.</p>
</td></tr>
<tr><td align="center" style="padding:18px 36px 0;"><p style="margin:0;font-family:${FONT};font-size:12px;color:${MUTED};">UB Freight Ltd &middot; Auckland, New Zealand</p></td></tr>
</table></td></tr></table></body></html>`;
  const text = [subject, "", hello, "", ...lines, "", `Set your password: ${o.link}`, "", "Didn't expect this? Ignore this email and nothing happens."].join("\n");
  return { subject, html, text };
}
