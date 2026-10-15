// Customer quote reminder emails. Corporate letter look: white page, logo + navy rule, summary table,
// square buttons. Table layout + inline styles, VML buttons for Outlook desktop.
import { esc, money, nzDate, transitText } from "./quoteEmail.ts";

const LOGO_URL = "https://console.ubfreight.com/email/ubf-logo.png";
const NAVY = "#0A2472", INK = "#1F2937", BODY = "#374151", MUTED = "#6B7280", LINE = "#D1D5DB", SOFT = "#F3F4F6";
const FONT = "'Segoe UI', Calibri, Arial, Helvetica, sans-serif";

export type ReminderOption = { carrier: string | null; transit_days: string | null; total: number | null; currency: string | null; valid_till: string | null };
export type CustomerReminder = {
  contactName: string | null; customerName: string | null; quoteNo: string; lane: string; expiresAt: string | null;
  options: ReminderOption[]; acceptUrl: string; declineUrl: string; viewUrl: string;
  ownerName: string | null; ownerEmail: string | null; pdfAttached?: boolean;
};

const para = (html: string, extra = "") =>
  `<p style="margin:0 0 12px;font-family:${FONT};font-size:14px;line-height:21px;color:${BODY};${extra}">${html}</p>`;

/** Square button. Solid navy, or outline. */
function btn(label: string, url: string, solid: boolean, width: number): string {
  const u = esc(url), l = esc(label);
  const fill = solid ? NAVY : "#FFFFFF", text = solid ? "#FFFFFF" : NAVY;
  return `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${u}" style="height:38px;v-text-anchor:middle;width:${width}px;" arcsize="5%" strokecolor="${NAVY}" strokeweight="1px" fillcolor="${fill}"><w:anchorlock/><center style="color:${text};font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${l}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${u}" target="_blank" style="display:inline-block;background:${fill};color:${text};border:1px solid ${NAVY};font-family:${FONT};font-size:14px;font-weight:600;line-height:36px;height:36px;padding:0 22px;border-radius:2px;text-decoration:none;mso-hide:all;">${l}</a><!--<![endif]-->`;
}

function buttons(r: CustomerReminder): string {
  const multi = r.options.length > 1;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 8px;"><tr>
<td style="padding:0 10px 0 0;">${btn(multi ? "Choose and accept" : "Accept quote", multi ? r.viewUrl : r.acceptUrl, true, 180)}</td>
<td>${btn("Decline", r.declineUrl, false, 110)}</td></tr></table>
<p style="margin:0 0 16px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">No login needed. Your reply goes straight to our team.</p>`;
}

function summary(r: CustomerReminder): string {
  const row = (k: string, v: string) => `<tr>
<td style="padding:7px 12px;border-bottom:1px solid ${LINE};background:${SOFT};font-family:${FONT};font-size:12px;color:${MUTED};width:130px;white-space:nowrap;">${k}</td>
<td style="padding:7px 12px;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:13px;color:${INK};">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-bottom:0;margin:4px 0 16px;">
${row("Quote reference", esc(r.quoteNo))}${r.customerName ? row("Customer", esc(r.customerName)) : ""}${row("Route", esc(r.lane))}
${r.expiresAt ? row("Valid until", esc(nzDate(r.expiresAt))) : ""}${r.ownerName ? row("Prepared by", esc(r.ownerName)) : ""}</table>`;
}

function options(r: CustomerReminder): string {
  if (!r.options.length) return "";
  const multi = r.options.length > 1;
  const h = (t: string, right = false) => `<td style="padding:7px 12px;background:${NAVY};font-family:${FONT};font-size:11px;letter-spacing:.4px;text-transform:uppercase;color:#FFFFFF;${right ? "text-align:right;" : ""}">${t}</td>`;
  const c = (t: string, right = false) => `<td style="padding:8px 12px;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:13px;color:${INK};${right ? "text-align:right;white-space:nowrap;" : ""}">${t}</td>`;
  const rows = r.options.map((o, i) =>
    `<tr>${c(esc(o.carrier ?? (multi ? `Option ${i + 1}` : "Quoted rate")))}${c(esc(transitText(o.transit_days)) || "&nbsp;")}${c(`<b>${esc(money(o.total, o.currency))}</b>`, true)}</tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-bottom:0;margin:0 0 16px;">
<tr>${h("Option")}${h("Transit")}${h("Total", true)}</tr>${rows}</table>`;
}

function signature(r: CustomerReminder): string {
  return `<p style="margin:18px 0 0;font-family:${FONT};font-size:14px;line-height:21px;color:${INK};">Kind regards,<br>
<b>${esc(r.ownerName ?? "Sales Support")}</b><br><span style="color:${MUTED};font-size:13px;">UB Freight Ltd${r.ownerEmail ? ` | <a href="mailto:${esc(r.ownerEmail)}" style="color:${NAVY};">${esc(r.ownerEmail)}</a>` : ""}</span></p>`;
}

function intro(r: CustomerReminder): string {
  const hello = r.contactName?.trim() ? `Dear ${esc(r.contactName.trim().split(/\s+/)[0])},` : "Hello,";
  return para(hello)
    + para(`We are following up on our quotation <b style="color:${INK};">${esc(r.quoteNo)}</b> for ${esc(r.lane)}${r.expiresAt ? `, valid until <b style="color:${INK};">${esc(nzDate(r.expiresAt))}</b>` : ""}. Please let us know if you would like to proceed.`)
    + (r.pdfAttached ? para("The full quotation is attached as a PDF.") : "");
}

/** New email: full corporate letter. */
export function renderCustomerReminder(r: CustomerReminder): { subject: string; html: string } {
  const inner = intro(r) + summary(r) + options(r)
    + para(r.options.length > 1 ? "Choose an option to accept, or let us know if the shipment is not going ahead." : "Accept or decline below, or simply reply to this email with any questions.")
    + buttons(r) + signature(r);
  const html = `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Quotation ${esc(r.quoteNo)}</title>
<style>@media (max-width:620px){.px{padding-left:16px!important;padding-right:16px!important;}}</style></head>
<body style="margin:0;padding:0;background:#FFFFFF;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Quotation ${esc(r.quoteNo)} for ${esc(r.lane)} is awaiting your reply.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;">
<tr><td class="px" style="padding:0 24px 14px;border-bottom:2px solid ${NAVY};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td><img src="${LOGO_URL}" width="96" height="47" alt="UB Freight" style="display:block;border:0;width:96px;height:47px;"></td>
<td align="right" style="font-family:${FONT};font-size:12px;letter-spacing:.6px;text-transform:uppercase;color:${NAVY};">Quotation follow-up<br><span style="color:${MUTED};letter-spacing:0;text-transform:none;">${esc(r.quoteNo)}</span></td>
</tr></table></td></tr>
<tr><td class="px" style="padding:22px 24px 8px;">${inner}</td></tr>
<tr><td class="px" style="padding:16px 24px 0;border-top:1px solid ${LINE};font-family:${FONT};font-size:11px;line-height:17px;color:${MUTED};">
UB Freight Ltd | Auckland, New Zealand | <a href="https://ubfreight.com" style="color:${MUTED};">ubfreight.com</a><br>
You are receiving this because you requested a quotation from UB Freight.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: `Quotation ${r.quoteNo}: ${r.lane}${r.expiresAt ? ` (valid until ${nzDate(r.expiresAt)})` : ""}`, html };
}

/** Reply inside an existing thread: same content, no letterhead (the thread already has context). */
export function renderReminderReply(r: CustomerReminder): string {
  return `<div style="font-family:${FONT};max-width:620px;">${intro(r)}${summary(r)}${options(r)}${buttons(r)}${signature(r)}</div>`;
}
