// Branded HTML for the Import Sea 7am digest. Table layout + inline styles for Outlook/Gmail.

export type DigestRow = {
  section: "empty_return" | "at_port" | "arriving";
  job_no: string | null;
  importer: string | null;
  container_no: string | null;
  shipping_line: string | null;
  eta: string | null;
  last_free_day: string | null;
  return_depot: string | null;
};

const CONSOLE_URL = "https://console.ubfreight.com";
const LOGO_URL = `${CONSOLE_URL}/email/ubf-logo.png`;
const NAVY = "#0A2472";
const ORANGE = "#F7941D";
const INK = "#1E293B";
const BODY = "#475569";
const MUTED = "#94A3B8";
const LINE = "#E2E8F0";
const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";

const PILL: Record<string, { bg: string; fg: string }> = {
  red: { bg: "#FEE2E2", fg: "#B91C1C" },
  amber: { bg: "#FEF3C7", fg: "#B45309" },
  green: { bg: "#DCFCE7", fg: "#15803D" },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dash = (v: string | null) => (v && v.trim() ? esc(v) : "&mdash;");

function fmtDate(iso: string | null): string {
  if (!iso) return "&mdash;";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${d} ${mon} ${String(y).slice(2)}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso.slice(0, 10)) - Date.parse(fromIso.slice(0, 10))) / 86400000);
}

/** Red: overdue or due within 1 day. Amber: 2-3 days. Green: 4+ days. */
export function lfdTone(lfd: string | null, today: string): keyof typeof PILL | null {
  if (!lfd) return null;
  const d = daysBetween(today, lfd);
  if (d <= 1) return "red";
  if (d <= 3) return "amber";
  return "green";
}

function lfdCell(lfd: string | null, today: string): string {
  const tone = lfdTone(lfd, today);
  if (!tone) return "&mdash;";
  const d = daysBetween(today, lfd!);
  const hint = d < 0 ? `${-d}d over` : d === 0 ? "today" : `${d}d`;
  const c = PILL[tone];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;background:${c.bg};color:${c.fg};font-weight:600;white-space:nowrap;">${fmtDate(lfd)} &middot; ${hint}</span>`;
}

type Col = { label: string; cell: (r: DigestRow) => string };

function table(rows: DigestRow[], cols: Col[]): string {
  const th = cols.map((c) =>
    `<th align="left" style="padding:8px 10px;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:${MUTED};font-weight:600;white-space:nowrap;">${c.label}</th>`).join("");
  const body = rows.map((r) => `<tr>${cols.map((c) =>
    `<td style="padding:8px 10px;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:13px;line-height:18px;color:${INK};vertical-align:top;">${c.cell(r)}</td>`).join("")}</tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>${th}</tr>${body}</table>`;
}

function section(title: string, count: number, inner: string): string {
  const content = count
    ? inner
    : `<p style="margin:0;font-family:${FONT};font-size:13px;color:${MUTED};">Nothing today.</p>`;
  return `<tr><td style="background:#ffffff;padding:24px 32px 8px;" class="px">
<h2 style="margin:0 0 12px;font-family:${FONT};font-size:16px;line-height:22px;font-weight:600;color:${NAVY};">${title} <span style="color:${MUTED};font-weight:500;">(${count})</span></h2>
${content}</td></tr>`;
}

export function renderDigest(rows: DigestRow[], today: string): { html: string; text: string; subject: string } {
  const ret = rows.filter((r) => r.section === "empty_return");
  const port = rows.filter((r) => r.section === "at_port");
  const arr = rows.filter((r) => r.section === "arriving");

  const core: Col[] = [
    { label: "CF job #", cell: (r) => dash(r.job_no) },
    { label: "Importer", cell: (r) => dash(r.importer) },
    { label: "Container", cell: (r) => `<span style="font-family:Consolas,monospace;">${dash(r.container_no)}</span>` },
    { label: "Shipping line", cell: (r) => dash(r.shipping_line) },
    { label: "ETA", cell: (r) => fmtDate(r.eta) },
  ];
  const lfd: Col = { label: "LFD", cell: (r) => lfdCell(r.last_free_day, today) };
  const depot: Col = { label: "Return depot", cell: (r) => dash(r.return_depot) };

  const subject = `Import Sea digest ${fmtDate(today).replace(/&mdash;/, "")}: ${ret.length} returns, ${port.length} at port, ${arr.length} arriving`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>Import Sea digest</title>
<style>@media (max-width:600px){.px{padding-left:16px!important;padding-right:16px!important;}}</style></head>
<body style="margin:0;padding:0;background:#F1F4F9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F4F9;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="760" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:760px;">
<tr><td style="background:${NAVY};height:4px;line-height:4px;font-size:0;border-radius:12px 12px 0 0;">&nbsp;</td></tr>
<tr><td style="background:#ffffff;padding:28px 32px 4px;" class="px">
<img src="${LOGO_URL}" width="96" height="47" alt="UB Freight" style="display:block;border:0;width:96px;height:47px;">
<p style="margin:20px 0 6px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${ORANGE};">Import Sea &middot; Daily digest</p>
<h1 style="margin:0;font-family:${FONT};font-size:22px;line-height:30px;font-weight:600;color:${INK};">${fmtDate(today)}</h1>
<p style="margin:6px 0 0;font-family:${FONT};font-size:13px;color:${BODY};">LFD colour: <b style="color:#B91C1C;">red</b> overdue or &le;1 day, <b style="color:#B45309;">amber</b> 2&ndash;3 days, <b style="color:#15803D;">green</b> 4+ days.</p>
</td></tr>
${section("Empty return due", ret.length, table(ret, [...core, lfd, depot]))}
${section("At port, ready for collection", port.length, table(port, [...core, lfd]))}
${section("Arriving next 7 days", arr.length, table(arr, core))}
<tr><td style="background:#ffffff;padding:20px 32px 28px;border-radius:0 0 12px 12px;" class="px">
<a href="${CONSOLE_URL}/bookings/import-sea" style="font-family:${FONT};font-size:14px;font-weight:600;color:${NAVY};">Open Import Sea board &rarr;</a>
</td></tr>
<tr><td align="center" style="padding:20px 32px 0;">
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">You subscribed on the Import Sea board. Turn it off there with the mail icon.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  const line = (r: DigestRow, extra = "") =>
    `- ${r.job_no ?? "-"} | ${r.importer ?? "-"} | ${r.container_no ?? "-"} | ${r.shipping_line ?? "-"} | ETA ${r.eta ?? "-"}${extra}`;
  const text = [
    `Import Sea digest ${today}`, "",
    `EMPTY RETURN DUE (${ret.length})`, ...ret.map((r) => line(r, ` | LFD ${r.last_free_day ?? "-"} | Depot ${r.return_depot ?? "-"}`)), "",
    `AT PORT (${port.length})`, ...port.map((r) => line(r, ` | LFD ${r.last_free_day ?? "-"}`)), "",
    `ARRIVING NEXT 7 DAYS (${arr.length})`, ...arr.map((r) => line(r)), "",
    `${CONSOLE_URL}/bookings/import-sea`,
  ].join("\n");

  return { html, text, subject: subject.replace(/&[a-z]+;/g, "") };
}
