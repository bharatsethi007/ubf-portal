// Branded transactional email for staff accounts (invite, password reset).
// Table layout + inline styles + VML button so it renders cleanly in Outlook, Gmail and Apple Mail.

const CONSOLE_URL = "https://console.ubfreight.com";
const LOGO_URL = `${CONSOLE_URL}/email/ubf-logo.png`;
const NAVY = "#0A2472";
const ORANGE = "#F7941D";
const INK = "#1E293B";
const BODY = "#475569";
const MUTED = "#94A3B8";
const LINE = "#E2E8F0";
const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";

export const SENDER_NAME = "UBF Internal";

export type StaffEmail = {
  preheader: string;
  eyebrow: string;
  title: string;
  name?: string | null;
  paragraphs: string[];
  button: { label: string; url: string };
  expiry: string;
  note: string;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function button(label: string, url: string): string {
  const u = esc(url), l = esc(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td>
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${u}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="17%" stroke="f" fillcolor="${NAVY}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${l}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${u}" target="_blank" style="display:inline-block;background:${NAVY};color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;line-height:48px;height:48px;padding:0 32px;border-radius:8px;text-decoration:none;mso-hide:all;">${l}</a><!--<![endif]-->
</td></tr></table>`;
}

export function renderStaffEmail(e: StaffEmail): { html: string; text: string } {
  const hello = e.name?.trim() ? `Hi ${esc(e.name.trim())},` : "Hi,";
  const paras = e.paragraphs.map((p) =>
    `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:24px;color:${BODY};">${p}</p>`).join("");

  const html = `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(e.title)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>a{color:${NAVY};} @media (max-width:600px){.px{padding-left:24px!important;padding-right:24px!important;}}</style></head>
<body style="margin:0;padding:0;background:#F1F4F9;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(e.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F4F9;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">

<tr><td style="background:${NAVY};height:4px;line-height:4px;font-size:0;border-radius:12px 12px 0 0;">&nbsp;</td></tr>
<tr><td style="background:#ffffff;padding:32px 40px 0;" class="px">
<img src="${LOGO_URL}" width="112" height="55" alt="UB Freight" style="display:block;border:0;outline:none;width:112px;height:55px;">
</td></tr>
<tr><td style="background:#ffffff;padding:28px 40px 0;" class="px"><div style="border-top:1px solid ${LINE};height:1px;line-height:1px;font-size:0;">&nbsp;</div></td></tr>

<tr><td style="background:#ffffff;padding:32px 40px 8px;" class="px">
<p style="margin:0 0 12px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${ORANGE};">${esc(e.eyebrow)}</p>
<h1 style="margin:0 0 24px;font-family:${FONT};font-size:24px;line-height:32px;font-weight:600;color:${INK};">${esc(e.title)}</h1>
<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:24px;color:${BODY};">${hello}</p>
${paras}
</td></tr>

<tr><td style="background:#ffffff;padding:8px 40px 12px;" class="px">${button(e.button.label, e.button.url)}</td></tr>
<tr><td style="background:#ffffff;padding:0 40px 32px;" class="px">
<p style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};">${esc(e.expiry)}</p>
</td></tr>

<tr><td style="background:#ffffff;padding:0 40px;" class="px"><div style="border-top:1px solid ${LINE};height:1px;line-height:1px;font-size:0;">&nbsp;</div></td></tr>
<tr><td style="background:#ffffff;padding:24px 40px 36px;border-radius:0 0 12px 12px;" class="px">
<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;line-height:20px;color:${BODY};">Button not working? Copy this link into your browser:</p>
<p style="margin:0 0 20px;font-family:${FONT};font-size:12px;line-height:18px;word-break:break-all;"><a href="${esc(e.button.url)}" style="color:${NAVY};text-decoration:underline;">${esc(e.button.url)}</a></p>
<p style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;color:${BODY};">${esc(e.note)}</p>
</td></tr>

<tr><td align="center" style="padding:24px 40px 0;">
<p style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">UB Freight Ltd &middot; Auckland, New Zealand</p>
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">Automated message from UBF Console. Replies to this address are not monitored.</p>
</td></tr>

</table></td></tr></table>
</body></html>`;

  const strip = (s: string) => s.replace(/<[^>]+>/g, "");
  const text = [
    e.title, "", hello, "", ...e.paragraphs.map(strip).flatMap((p) => [p, ""]),
    `${e.button.label}: ${e.button.url}`, "", e.expiry, "", e.note, "",
    "UB Freight Ltd, Auckland, New Zealand",
  ].join("\n");
  return { html, text };
}

export async function sendStaffEmail(to: string, subject: string, email: StaffEmail): Promise<boolean> {
  const key = Deno.env.get("BREVO_API_KEY");
  if (!key) { console.error("BREVO_API_KEY not set"); return false; }
  const from = Deno.env.get("STAFF_INVITE_FROM_EMAIL") ?? "no-reply@ubfreight.com";
  const { html, text } = renderStaffEmail(email);
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { email: from, name: SENDER_NAME }, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
    });
    if (!r.ok) console.error("brevo send failed", r.status, await r.text());
    return r.ok;
  } catch (e) {
    console.error("brevo send error", String(e));
    return false;
  }
}
