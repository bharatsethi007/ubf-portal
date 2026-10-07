// Branded quote emails (customer reminder + staff digest). Table layout, inline styles, VML buttons for Outlook.
const LOGO_URL = "https://console.ubfreight.com/email/ubf-logo.png";
const NAVY = "#0A2472", ORANGE = "#F7941D", INK = "#1E293B", BODY = "#475569", MUTED = "#94A3B8", LINE = "#E2E8F0";
const GREEN = "#047857";
const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";

export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function nzDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-NZ", { timeZone: "Pacific/Auckland", day: "numeric", month: "short", year: "numeric" });
}

export function money(n: number | null | undefined, cur: string | null | undefined): string {
  if (n == null) return "";
  return `${cur ?? "NZD"} ${Number(n).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function button(label: string, url: string, fill: string, width = 200): string {
  const u = esc(url), l = esc(label);
  return `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${u}" style="height:44px;v-text-anchor:middle;width:${width}px;" arcsize="18%" stroke="f" fillcolor="${fill}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${l}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${u}" target="_blank" style="display:inline-block;background:${fill};color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;line-height:44px;height:44px;padding:0 28px;border-radius:8px;text-decoration:none;mso-hide:all;">${l}</a><!--<![endif]-->`;
}

function shell(preheader: string, eyebrow: string, title: string, inner: string, footer: string): string {
  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title>
<style>a{color:${NAVY};} @media (max-width:600px){.px{padding-left:20px!important;padding-right:20px!important;}}</style></head>
<body style="margin:0;padding:0;background:#F1F4F9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F4F9;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="background:${NAVY};height:4px;line-height:4px;font-size:0;border-radius:12px 12px 0 0;">&nbsp;</td></tr>
<tr><td style="background:#ffffff;padding:28px 36px 0;" class="px"><img src="${LOGO_URL}" width="104" height="51" alt="UB Freight" style="display:block;border:0;width:104px;height:51px;"></td></tr>
<tr><td style="background:#ffffff;padding:24px 36px 8px;" class="px">
<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${ORANGE};">${esc(eyebrow)}</p>
<h1 style="margin:0 0 20px;font-family:${FONT};font-size:22px;line-height:30px;font-weight:600;color:${INK};">${esc(title)}</h1>
${inner}
</td></tr>
<tr><td style="background:#ffffff;padding:8px 36px 32px;border-radius:0 0 12px 12px;" class="px">${footer}</td></tr>
<tr><td align="center" style="padding:20px 36px 0;"><p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">UB Freight Ltd &middot; Auckland, New Zealand</p></td></tr>
</table></td></tr></table></body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:23px;color:${BODY};">${html}</p>`;
const th = (t: string, right = false) => `<td style="padding:8px 10px;background:#F8FAFC;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:11px;letter-spacing:.4px;text-transform:uppercase;color:${MUTED};${right ? "text-align:right;" : ""}">${t}</td>`;
const td = (t: string, right = false) => `<td style="padding:10px;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:14px;color:${INK};${right ? "text-align:right;white-space:nowrap;" : ""}">${t}</td>`;

export type ReminderOption = { carrier: string | null; transit_days: number | null; total: number | null; currency: string | null; valid_till: string | null };
export type CustomerReminder = {
  contactName: string | null; customerName: string | null; quoteNo: string; lane: string; expiresAt: string | null;
  options: ReminderOption[]; acceptUrl: string; declineUrl: string; viewUrl: string; ownerName: string | null; ownerEmail: string | null;
};

export function renderCustomerReminder(r: CustomerReminder): { subject: string; html: string } {
  const hello = r.contactName?.trim() ? `Hi ${esc(r.contactName.trim().split(/\s+/)[0])},` : "Hi,";
  const rows = r.options.map((o, i) => `<tr>${td(esc(o.carrier ?? (r.options.length > 1 ? `Option ${i + 1}` : "Your rate")))}${td(o.transit_days ? `${o.transit_days} days` : "")}${td(esc(money(o.total, o.currency)), true)}</tr>`).join("");
  const table = r.options.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:8px;margin:4px 0 20px;"><tr>${th("Option")}${th("Transit")}${th("Total", true)}</tr>${rows}</table>`
    : "";
  const multi = r.options.length > 1;
  const inner = p(hello)
    + p(`Just a reminder that quote <b style="color:${INK};">${esc(r.quoteNo)}</b> for <b style="color:${INK};">${esc(r.lane)}</b> is waiting for your reply${r.expiresAt ? `. It is valid until <b style="color:${INK};">${esc(nzDate(r.expiresAt))}</b>` : ""}.`)
    + table
    + p(multi ? "Pick an option to accept, or let us know if it is not going ahead. One click updates our system." : "Accept or decline below. One click updates our system.");
  const footer = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding:0 10px 10px 0;">${button(multi ? "Choose and accept" : "Accept quote", multi ? r.viewUrl : r.acceptUrl, GREEN, 200)}</td>
<td style="padding:0 0 10px 0;">${button("Decline", r.declineUrl, "#64748B", 130)}</td></tr></table>
<p style="margin:14px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${BODY};">Questions or need changes? Just reply to this email${r.ownerName ? ` and ${esc(r.ownerName)} will get back to you` : ""}.</p>
<p style="margin:14px 0 0;font-family:${FONT};font-size:14px;line-height:21px;color:${INK};">Kind regards,<br>${esc(r.ownerName ?? "UB Freight Sales Support")}<br><span style="color:${MUTED};">UB Freight Ltd${r.ownerEmail ? ` &middot; ${esc(r.ownerEmail)}` : ""}</span></p>`;
  return {
    subject: `Reminder: quote ${r.quoteNo} for ${r.lane}${r.expiresAt ? ` (valid until ${nzDate(r.expiresAt)})` : ""}`,
    html: shell(`Your quote ${r.quoteNo} is waiting for your reply`, "Quote reminder", `Your quote is waiting`, inner, footer),
  };
}

export type DigestRow = { quoteNo: string; customer: string; lane: string; agedDays: number; expiresAt: string | null; lastReminded: string | null; url: string };

export function renderStaffDigest(name: string | null, rows: DigestRow[], consoleUrl: string): { subject: string; html: string } {
  const body = rows.map((r) => {
    const left = r.expiresAt ? Math.ceil((new Date(r.expiresAt).getTime() - Date.now()) / 86400000) : null;
    const leftTxt = left == null ? "" : left <= 0 ? "Today" : `${left}d`;
    const leftColor = left != null && left <= 7 ? "#B45309" : INK;
    return `<tr>${td(`<a href="${esc(r.url)}" style="color:${NAVY};text-decoration:none;">${esc(r.quoteNo)}</a>`)}${td(esc(r.customer))}${td(esc(r.lane))}${td(`${r.agedDays}d`, true)}${td(`<span style="color:${leftColor};">${leftTxt}</span>`, true)}${td(r.lastReminded ? esc(nzDate(r.lastReminded)) : "Never", true)}</tr>`;
  }).join("");
  const inner = p(`Hi ${esc(name?.split(/\s+/)[0] ?? "there")},`)
    + p(`You have <b style="color:${INK};">${rows.length}</b> open quote${rows.length === 1 ? "" : "s"} priced more than a week ago. Quotes auto-close as lost 30 days after pricing.`)
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:8px;margin:4px 0 20px;"><tr>${th("Quote")}${th("Customer")}${th("Lane")}${th("Age", true)}${th("Expires", true)}${th("Reminded", true)}</tr>${body}</table>`;
  const footer = `${button("Send customer reminders", `${consoleUrl}/quotes?reminders=1`, NAVY, 250)}
<p style="margin:14px 0 0;font-family:${FONT};font-size:13px;color:${MUTED};">Weekly summary from UBF Console.</p>`;
  return {
    subject: `${rows.length} open quote${rows.length === 1 ? "" : "s"} to follow up`,
    html: shell(`${rows.length} open quotes need a follow up`, "Weekly quote follow-up", "Quotes waiting on customers", inner, footer),
  };
}
