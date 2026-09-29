// Portal notification digest email. Table layout + inline styles for Outlook/Gmail. Matches portal-booking-notify branding.

const LOGO_URL = "https://console.ubfreight.com/email/ubf-logo.png";
const NAVY = "#0A2472";
const ORANGE = "#F7941D";
const INK = "#1E293B";
const BODY = "#475569";
const MUTED = "#94A3B8";
const LINE = "#E2E8F0";
const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";

export type Item = { id: number; kind: string; title: string; body: string | null; facts: Record<string, unknown>; job_unique: number | null; invoice_no: string | null };

export const KIND: Record<string, { label: string; color: string }> = {
  shipment_created: { label: "New shipment", color: "#2563EB" },
  departed: { label: "Departed", color: "#2563EB" },
  eta_changed: { label: "ETA change", color: "#D97706" },
  arrived: { label: "Arrived", color: "#15803D" },
  released: { label: "Released at port", color: "#15803D" },
  invoice_issued: { label: "Invoice", color: "#0A2472" },
  message: { label: "Message", color: "#7C3AED" },
  quote_ready: { label: "Quote ready", color: "#F7941D" },
};

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function itemUrl(portal: string, i: Item): string {
  if (i.kind === "message" && typeof i.facts?.thread_id === "string") return `${portal}/portal/messages?t=${encodeURIComponent(i.facts.thread_id)}`;
  if (i.kind === "quote_ready" && typeof i.facts?.response_id === "string") return `${portal}/portal/rates?tab=quotes&q=${encodeURIComponent(i.facts.response_id)}`;
  if (i.kind === "invoice_issued" && i.invoice_no) return `${portal}/portal/billing?tab=all&inv=${encodeURIComponent(i.invoice_no)}`;
  if (i.job_unique != null) return `${portal}/portal/shipments/${encodeURIComponent(`#${i.job_unique}`)}`;
  return `${portal}/portal`;
}

function card(portal: string, i: Item): string {
  const k = KIND[i.kind] ?? { label: "Update", color: NAVY };
  const f = i.facts ?? {};
  const sub = [f.ref ? `Your ref ${f.ref}` : null, typeof f.party === "string" ? f.party : null].filter(Boolean).join(" · ");
  return `<tr><td style="padding:0 0 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-left:4px solid ${k.color};border-radius:8px;">
<tr><td style="padding:14px 16px;">
<p style="margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${k.color};">${esc(k.label)}</p>
<p style="margin:0 0 4px;font-family:${FONT};font-size:16px;font-weight:600;line-height:22px;color:${INK};">${esc(i.title)}</p>
${i.body ? `<p style="margin:0 0 4px;font-family:${FONT};font-size:14px;line-height:21px;color:${BODY};">${esc(i.body)}</p>` : ""}
${sub ? `<p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">${esc(sub)}</p>` : ""}
<a href="${esc(itemUrl(portal, i))}" target="_blank" style="font-family:${FONT};font-size:13px;font-weight:600;color:${NAVY};text-decoration:none;">${i.kind === "invoice_issued" ? "View invoice" : i.kind === "message" ? "Read and reply" : i.kind === "quote_ready" ? "Review and approve" : "Track shipment"} &rarr;</a>
</td></tr></table></td></tr>`;
}

export function subjectFor(items: Item[]): string {
  if (items.length === 1) return items[0].title;
  const kinds = new Set(items.map((i) => i.kind));
  if (kinds.size === 1 && kinds.has("invoice_issued")) return `${items.length} new invoices from UB Freight`;
  return `${items.length} updates on your UB Freight shipments`;
}

export function renderDigest(portal: string, name: string | null, customer: string | null, items: Item[]): { html: string; text: string } {
  const who = customer ? customer.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Ltd|Nz)\b/g, (m) => m.toUpperCase()) : null;
  const title = items.length === 1 ? items[0].title : `${items.length} updates for ${who ?? "you"}`;
  const hello = name ? `Hi ${esc(name.split(/\s+/)[0])},` : "Hello,";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${esc(title)}</title>
<style>@media (max-width:600px){.px{padding-left:20px!important;padding-right:20px!important;}}</style></head>
<body style="margin:0;padding:0;background:#F1F4F9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(items.map((i) => i.title).join(" · "))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F4F9;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="background:${NAVY};height:4px;line-height:4px;font-size:0;border-radius:12px 12px 0 0;">&nbsp;</td></tr>
<tr><td style="background:#ffffff;padding:28px 36px 8px;" class="px">
<img src="${LOGO_URL}" width="96" height="47" alt="UB Freight" style="display:block;border:0;width:96px;height:47px;">
<p style="margin:22px 0 8px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${ORANGE};">Shipment updates</p>
<h1 style="margin:0 0 14px;font-family:${FONT};font-size:22px;line-height:30px;font-weight:600;color:${INK};">${esc(title)}</h1>
<p style="margin:0 0 18px;font-family:${FONT};font-size:15px;line-height:23px;color:${BODY};">${hello} here's what changed${items.length > 1 ? " since our last update" : ""}.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items.map((i) => card(portal, i)).join("")}</table>
</td></tr>
<tr><td style="background:#ffffff;padding:14px 36px 30px;border-radius:0 0 12px 12px;" class="px">
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">You get these because you have a UB Freight portal account. Choose which updates you get in <a href="${esc(portal)}/portal/settings/notifications" style="color:${MUTED};">notification settings</a>. Reply to reach our team.</p>
</td></tr>
<tr><td align="center" style="padding:18px 36px 0;"><p style="margin:0;font-family:${FONT};font-size:12px;color:${MUTED};">UB Freight Ltd &middot; Auckland, New Zealand</p></td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    title, "", `${name ? `Hi ${name.split(/\s+/)[0]},` : "Hello,"} here's what changed.`, "",
    ...items.flatMap((i) => [`${(KIND[i.kind] ?? { label: "Update" }).label}: ${i.title}`, i.body ?? "", itemUrl(portal, i), ""]),
    `Change which updates you get: ${portal}/portal/settings/notifications`,
  ].join("\n");
  return { html, text };
}
