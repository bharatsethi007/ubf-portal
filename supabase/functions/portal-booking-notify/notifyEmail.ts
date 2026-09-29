// Branded HTML for portal booking emails (staff alert + customer status). Table layout + inline styles for Outlook/Gmail.

const LOGO_URL = "https://console.ubfreight.com/email/ubf-logo.png";
const NAVY = "#0A2472";
const ORANGE = "#F7941D";
const INK = "#1E293B";
const BODY = "#475569";
const MUTED = "#94A3B8";
const LINE = "#E2E8F0";
const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";

export type Fact = [label: string, value: string | null | undefined];

export type NotifyEmail = {
  preheader: string;
  eyebrow: string;
  title: string;
  intro: string[];
  callout?: { tone: "amber" | "red" | "green"; text: string } | null;
  facts: Fact[];
  button: { label: string; url: string };
  footer: string;
};

const TONE = {
  amber: { bg: "#FFF7ED", border: "#FDBA74", fg: "#9A3412" },
  red: { bg: "#FEF2F2", border: "#FCA5A5", fg: "#991B1B" },
  green: { bg: "#F0FDF4", border: "#86EFAC", fg: "#166534" },
};

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function button(label: string, url: string): string {
  const u = esc(url), l = esc(label);
  return `<a href="${u}" target="_blank" style="display:inline-block;background:${NAVY};color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;line-height:46px;height:46px;padding:0 28px;border-radius:8px;text-decoration:none;">${l}</a>`;
}

export function renderNotify(e: NotifyEmail): { html: string; text: string } {
  const paras = e.intro.map((p) =>
    `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:23px;color:${BODY};">${p}</p>`).join("");
  const facts = e.facts.filter(([, v]) => v != null && String(v).trim() !== "");
  const rows = facts.map(([k, v]) => `<tr>
<td style="padding:7px 12px 7px 0;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:12px;letter-spacing:.4px;text-transform:uppercase;color:${MUTED};white-space:nowrap;vertical-align:top;width:150px;">${esc(k)}</td>
<td style="padding:7px 0;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:14px;line-height:20px;color:${INK};vertical-align:top;">${esc(String(v))}</td></tr>`).join("");
  const c = e.callout ? TONE[e.callout.tone] : null;
  const callout = e.callout && c
    ? `<div style="margin:4px 0 18px;padding:12px 14px;border:1px solid ${c.border};background:${c.bg};border-radius:8px;font-family:${FONT};font-size:14px;line-height:21px;color:${c.fg};">${e.callout.text}</div>`
    : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${esc(e.title)}</title>
<style>@media (max-width:600px){.px{padding-left:20px!important;padding-right:20px!important;}}</style></head>
<body style="margin:0;padding:0;background:#F1F4F9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(e.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F4F9;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="background:${NAVY};height:4px;line-height:4px;font-size:0;border-radius:12px 12px 0 0;">&nbsp;</td></tr>
<tr><td style="background:#ffffff;padding:28px 36px 0;" class="px">
<img src="${LOGO_URL}" width="96" height="47" alt="UB Freight" style="display:block;border:0;width:96px;height:47px;">
<p style="margin:22px 0 8px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${ORANGE};">${esc(e.eyebrow)}</p>
<h1 style="margin:0 0 18px;font-family:${FONT};font-size:22px;line-height:30px;font-weight:600;color:${INK};">${esc(e.title)}</h1>
${paras}${callout}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 22px;">${rows}</table>
${button(e.button.label, e.button.url)}
</td></tr>
<tr><td style="background:#ffffff;padding:26px 36px 30px;border-radius:0 0 12px 12px;" class="px">
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">${esc(e.footer)}</p>
</td></tr>
<tr><td align="center" style="padding:18px 36px 0;"><p style="margin:0;font-family:${FONT};font-size:12px;color:${MUTED};">UB Freight Ltd &middot; Auckland, New Zealand</p></td></tr>
</table></td></tr></table></body></html>`;

  const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ");
  const text = [
    e.title, "", ...e.intro.map(strip), e.callout ? strip(e.callout.text) : "", "",
    ...facts.map(([k, v]) => `${k}: ${v}`), "", `${e.button.label}: ${e.button.url}`, "", e.footer,
  ].join("\n");
  return { html, text };
}
