// agreement-sign (verify_jwt = false; auth checked here).
// Agency agreement e-signature. In-house: token link, typed or drawn signature, audit events.
//
// POST { op: "send", id, to[], cc[], subject, message, expires_days }  staff JWT + has_perm('agreements','edit')
// POST { op: "get", token }                                           public: agreement for the signing page, marks viewed
// POST { op: "sign", token, fields, signature, consent }               public: agent confirms details and signs
// POST { op: "file", token, pdf_base64 }                               public, once: stores signed PDF, emails both parties
// POST { op: "create_link", id, expires_days }                      staff + agreements edit: signing link to share yourself, no email
// POST { op: "link", id }                                             staff: short-lived download link for the signed PDF
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { presign, putObject } from "../_shared/s3.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const clean = (l?: string[]) => [...new Set((l ?? []).map((e) => String(e).trim().toLowerCase()).filter(isEmail))];
const nzDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-NZ", { timeZone: "Pacific/Auckland", day: "numeric", month: "long", year: "numeric" }) : "";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const db = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const BASE = Deno.env.get("AGREEMENT_PUBLIC_BASE_URL") ?? "https://console.ubfreight.com";
const DEFAULT_SENDER = "bharats@ubfreight.com";
// All agreement email goes out from the sales support shared mailbox. Replies go to the staff member who sent it.
const SENDER = (Deno.env.get("AGREEMENT_SENDER") ?? "salessupport.nz@ubfreight.com").toLowerCase();
const GRAPH = "https://graph.microsoft.com/v1.0";
const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";

// Fields the signing page may see. Never tokens or internal ids beyond the agreement.
const PUBLIC_COLS = "id, ref, kind, status, effective_date, expiry_date, offices, agent_legal_name, agent_address, agent_company_no, agent_territory, signatory_name, signatory_title, signatory_email, agent_contacts, ubf_contacts, currency, credit_limit, payment_terms, agent_payment_terms, profit_share, insurance, agent_insurance, special_terms, ubf_signer_name, ubf_signer_title, ubf_signed_at, sent_at, viewed_at, signed_at, agent_signature, signed_pdf_key, created_at, updated_at, agent_id, remind_days";

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function graphToken(): Promise<string> {
  const tenant = Deno.env.get("MS_TENANT_ID"), id = Deno.env.get("MS_CLIENT_ID"), secret = Deno.env.get("MS_CLIENT_SECRET");
  if (!tenant || !id || !secret) throw new Error("Missing MS Graph env vars");
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`Graph token failed: ${res.status}`);
  return (await res.json()).access_token as string;
}

type Mail = { subject: string; html: string; to: string[]; cc?: string[]; replyTo?: string[]; attachment?: { name: string; base64: string } };
async function sendMail(mailbox: string, m: Mail) {
  const token = await graphToken();
  const rcpt = (l: string[]) => l.map((address) => ({ emailAddress: { address } }));
  const message: Record<string, unknown> = {
    subject: m.subject, body: { contentType: "HTML", content: m.html }, toRecipients: rcpt(m.to), ccRecipients: rcpt(m.cc ?? []),
    replyTo: rcpt(m.replyTo ?? []),
  };
  if (m.attachment) message.attachments = [{ "@odata.type": "#microsoft.graph.fileAttachment", name: m.attachment.name, contentType: "application/pdf", contentBytes: m.attachment.base64 }];
  const res = await fetch(`${GRAPH}/users/${encodeURIComponent(mailbox)}/sendMail`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });
  if (!res.ok) throw new Error(`Graph sendMail ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

const LOGO_URL = "https://console.ubfreight.com/email/ubf-logo.png";

// Branded, table-based email. Bulletproof button (VML for Outlook desktop, styled link elsewhere).
function emailHtml(paras: string[], button?: { label: string; url: string }): string {
  const para = (t: string) => `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:24px;color:#334155;">${esc(t).replace(/\n/g, "<br>")}</p>`;
  // Button sits above the sign-off so it reads as the call to action.
  const signOff = paras.length > 1 && /^(kind regards|regards|best|thanks|thank you|cheers|warm regards|sincerely)/i.test(paras[paras.length - 1]) ? paras[paras.length - 1] : null;
  const body = (signOff ? paras.slice(0, -1) : paras).map(para).join("");
  const u = button ? esc(button.url) : "", l = button ? esc(button.label) : "";
  const btn = button ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;"><tr><td align="left">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${u}" style="height:48px;v-text-anchor:middle;width:230px;" arcsize="17%" stroke="f" fillcolor="#0A2472"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${l}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${u}" target="_blank" style="display:inline-block;background-color:#0A2472;color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;line-height:48px;height:48px;padding:0 34px;border-radius:8px;text-decoration:none;mso-hide:all;">${l}</a><!--<![endif]-->
</td></tr></table>
<p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:18px;color:#64748B;">Button not working? Copy this link into your browser:</p>
<p style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:18px;word-break:break-all;"><a href="${u}" style="color:#0A2472;">${u}</a></p>` : "";
  return `<!doctype html><html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F4F9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F4F9;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="background:#0A2472;height:4px;line-height:4px;font-size:0;border-radius:12px 12px 0 0;">&nbsp;</td></tr>
<tr><td style="background:#ffffff;padding:28px 40px 20px;"><img src="${LOGO_URL}" width="104" height="51" alt="UB Freight" style="display:block;border:0;width:104px;height:51px;"></td></tr>
<tr><td style="background:#ffffff;padding:0 40px;"><div style="border-top:1px solid #E2E8F0;height:1px;line-height:1px;font-size:0;">&nbsp;</div></td></tr>
<tr><td style="background:#ffffff;padding:28px 40px 32px;border-radius:0 0 12px 12px;">
<p style="margin:0 0 14px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#E8742A;">Agency Co-operation Agreement</p>
${body}${btn}${signOff ? `<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>${para(signOff)}` : ""}
</td></tr>
<tr><td align="center" style="padding:20px 40px 0;"><p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:#94A3B8;">UB Freight Ltd &middot; 173 Montgomerie Road, Airport Oaks, Auckland &middot; New Zealand &middot; Fiji &middot; Australia</p></td></tr>
</table></td></tr></table></body></html>`;
}

async function event(id: string, kind: string, actor: string, detail?: Record<string, unknown>) {
  await db.from("agency_agreement_events").insert({ agreement_id: id, kind, actor, detail: detail ?? null });
}

async function byToken(token: unknown) {
  if (typeof token !== "string" || token.length < 32) return { error: "invalid_link" as const };
  const { data } = await db.from("agency_agreements").select(`${PUBLIC_COLS}, sign_token_expires_at`).eq("sign_token_hash", await sha256(token)).maybeSingle();
  if (!data || data.status === "void") return { error: "invalid_link" as const };
  if (data.status !== "signed" && data.sign_token_expires_at && new Date(data.sign_token_expires_at) < new Date()) return { error: "expired" as const };
  delete (data as Record<string, unknown>).sign_token_expires_at
  return { a: data as Record<string, any> };
}

async function opSend(req: Request, b: Record<string, any>) {
  const auth = req.headers.get("Authorization") ?? "";
  const user = createClient(URL_, ANON, { global: { headers: { Authorization: auth } } });
  const { data: u } = await user.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (!u?.user) return json({ error: "Sign in required" }, 401);
  const { data: ok } = await user.rpc("has_perm", { p_module: "agreements", p_op: "edit" });
  if (ok !== true) return json({ error: "Only Admins and Pricing Leads can send agreements" }, 403);

  const { data: a } = await db.from("agency_agreements").select("*").eq("id", b.id).maybeSingle();
  if (!a) return json({ error: "Agreement not found" }, 404);
  if (!["draft", "sent", "viewed"].includes(a.status)) return json({ error: `Cannot send a ${a.status} agreement` }, 400);
  const to = clean(b.to), cc = clean(b.cc).filter((e) => !to.includes(e));
  if (!to.length) return json({ error: "Add the agent's email" }, 400);

  const { data: me } = await db.from("staff_users").select("full_name, job_title, email").eq("user_id", u.user.id).maybeSingle();
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const days = Math.min(60, Math.max(3, Number(b.expires_days) || 14));
  const link = `${BASE}/agreement/${token}`;
  const now = new Date().toISOString();

  const staffEmail = (me?.email ?? u.user.email ?? DEFAULT_SENDER).toLowerCase();
  const paras = String(b.message ?? "").trim().split(/\n{2,}/).filter(Boolean);
  try {
    await sendMail(SENDER, { subject: String(b.subject ?? `UB Freight agency agreement ${a.ref}`), to, cc, replyTo: [staffEmail], html: emailHtml(paras, { label: "Review and sign", url: link }) });
  } catch (e) {
    const msg = String(e);
    return json({ error: /403|ErrorAccessDenied|404/.test(msg) ? `Portal cannot send from ${SENDER}. Ask IT to grant the portal app Mail.Send on that mailbox.` : msg.slice(0, 300) }, 502);
  }
  const { error: upErr } = await db.from("agency_agreements").update({
    status: "sent", sent_at: now, sign_token_hash: await sha256(token),
    sign_token_expires_at: new Date(Date.now() + days * 86400000).toISOString(),
    ubf_signed_at: a.ubf_signed_at ?? now,
    ubf_signer_id: a.ubf_signer_id ?? u.user.id,
    ubf_signer_name: a.ubf_signer_name ?? me?.full_name ?? null,
    ubf_signer_title: a.ubf_signer_title ?? me?.job_title ?? null,
  }).eq("id", a.id);
  if (upErr) return json({ error: upErr.message }, 500);
  await event(a.id, "sent", staffEmail, { to, cc, expires_days: days, from: SENDER });
  return json({ ok: true, link, from: SENDER });
}

async function opCreateLink(req: Request, b: Record<string, any>) {
  const auth = req.headers.get("Authorization") ?? "";
  const user = createClient(URL_, ANON, { global: { headers: { Authorization: auth } } });
  const { data: u } = await user.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (!u?.user) return json({ error: "Sign in required" }, 401);
  const { data: ok } = await user.rpc("has_perm", { p_module: "agreements", p_op: "edit" });
  if (ok !== true) return json({ error: "Only Admins and Pricing Leads can share agreements" }, 403);
  const { data: a } = await db.from("agency_agreements").select("*").eq("id", b.id).maybeSingle();
  if (!a) return json({ error: "Agreement not found" }, 404);
  if (!["draft", "sent", "viewed"].includes(a.status)) return json({ error: `Cannot share a ${a.status} agreement` }, 400);
  const { data: me } = await db.from("staff_users").select("full_name, job_title, email").eq("user_id", u.user.id).maybeSingle();
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const days = Math.min(60, Math.max(3, Number(b.expires_days) || 14));
  const now = new Date().toISOString();
  const { error } = await db.from("agency_agreements").update({
    status: a.status === "draft" ? "sent" : a.status, sent_at: a.sent_at ?? now, sign_token_hash: await sha256(token),
    sign_token_expires_at: new Date(Date.now() + days * 86400000).toISOString(),
    ubf_signed_at: a.ubf_signed_at ?? now,
    ubf_signer_id: a.ubf_signer_id ?? u.user.id,
    ubf_signer_name: a.ubf_signer_name ?? me?.full_name ?? null,
    ubf_signer_title: a.ubf_signer_title ?? me?.job_title ?? null,
  }).eq("id", a.id);
  if (error) return json({ error: error.message }, 500);
  await event(a.id, "link_created", (me?.email ?? u.user.email ?? "").toLowerCase(), { expires_days: days });
  return json({ ok: true, link: `${BASE}/agreement/${token}` });
}

async function opGet(b: Record<string, any>) {
  const r = await byToken(b.token);
  if ("error" in r) return json({ error: r.error }, r.error === "expired" ? 410 : 404);
  const a = r.a;
  if (a.status === "sent") {
    const now = new Date().toISOString();
    await db.from("agency_agreements").update({ status: "viewed", viewed_at: now }).eq("id", a.id);
    a.status = "viewed"; a.viewed_at = now;
    await event(a.id, "viewed", "agent");
  }
  return json({ agreement: a });
}

async function opSign(req: Request, b: Record<string, any>) {
  const r = await byToken(b.token);
  if ("error" in r) return json({ error: r.error }, r.error === "expired" ? 410 : 404);
  const a = r.a;
  if (a.status === "signed") return json({ error: "Already signed", agreement: a }, 409);
  if (b.consent !== true) return json({ error: "Please confirm you are authorised to sign" }, 400);
  const f = (b.fields ?? {}) as Record<string, any>;
  const txt = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const contacts = { ...(a.agent_contacts ?? {}) } as Record<string, string>;
  for (const k of ["operational", "commercial", "accounts", "notices"]) if (txt(f.agent_contacts?.[k])) contacts[k] = txt(f.agent_contacts[k]);
  const patch: Record<string, unknown> = {
    agent_legal_name: txt(f.agent_legal_name) || a.agent_legal_name,
    agent_address: txt(f.agent_address, 600) || a.agent_address,
    agent_company_no: txt(f.agent_company_no, 80) || a.agent_company_no,
    signatory_name: txt(f.signatory_name, 120) || a.signatory_name,
    signatory_title: txt(f.signatory_title, 120) || a.signatory_title,
    agent_contacts: contacts,
  };
  for (const [k, label] of [["agent_legal_name", "Legal entity"], ["agent_company_no", "Company number"], ["signatory_name", "Your name"], ["signatory_title", "Designation"]]) {
    if (!patch[k]) return json({ error: `${label} is required` }, 400);
  }
  if (!contacts.accounts) return json({ error: "Accounts contact is required" }, 400);

  const sig = (b.signature ?? {}) as Record<string, any>;
  const method = sig.method === "drawn" ? "drawn" : "typed";
  let image_key: string | null = null;
  if (method === "drawn") {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(sig.image ?? ""));
    if (!m || m[1].length > 400000) return json({ error: "Draw your signature again" }, 400);
    image_key = `agreements/${a.id}/agent-signature.png`;
    await putObject(image_key, Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)), "image/png");
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const signedAt = new Date().toISOString();
  const changed = Object.keys(patch).filter((k) => JSON.stringify(patch[k]) !== JSON.stringify(a[k]));
  const { data: out, error } = await db.from("agency_agreements").update({
    ...patch, status: "signed", signed_at: signedAt,
    agent_signature: { method, name: patch.signatory_name, title: patch.signatory_title, image_key, ip, ua: req.headers.get("user-agent")?.slice(0, 200) ?? null },
  }).eq("id", a.id).select(PUBLIC_COLS).single();
  if (error) return json({ error: error.message }, 500);
  if (changed.length) await event(a.id, "details_confirmed", "agent", { changed });
  await event(a.id, "signed", "agent", { name: patch.signatory_name, method, ip });
  return json({ agreement: out });
}

async function opFile(b: Record<string, any>) {
  const r = await byToken(b.token);
  if ("error" in r) return json({ error: r.error }, 404);
  const a = r.a;
  if (a.status !== "signed") return json({ error: "Not signed yet" }, 400);
  if (a.signed_pdf_key) return json({ ok: true, already: true });
  if (Date.now() - new Date(a.signed_at).getTime() > 3600000) return json({ error: "Filing window closed" }, 400);
  const b64 = String(b.pdf_base64 ?? "");
  if (!/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length > 12_000_000) return json({ error: "Bad PDF" }, 400);
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return json({ error: "Bad PDF" }, 400);
  const key = `agreements/${a.id}/${a.ref}-signed.pdf`;
  await putObject(key, bytes, "application/pdf");
  await db.from("agency_agreements").update({ signed_pdf_key: key }).eq("id", a.id);
  await event(a.id, "filed", "system", { key });

  const notice = String(a.ubf_contacts?.notices ?? DEFAULT_SENDER).replace(/.*·\s*/, "").trim().toLowerCase();
  const agentTo = clean([a.signatory_email]);
  const name = `UBF Agency Agreement ${a.ref}.pdf`;
  try {
    await sendMail(SENDER, {
      subject: `Signed: UB Freight agency agreement ${a.ref} · ${a.agent_legal_name}`,
      to: agentTo.length ? agentTo : [DEFAULT_SENDER], cc: isEmail(notice) && !agentTo.includes(notice) ? [notice] : [],
      replyTo: isEmail(notice) ? [notice] : [],
      html: emailHtml([
        `Thank you. The Agency Co-operation Agreement between UB Freight Ltd and ${a.agent_legal_name} is now signed by both parties.`,
        `It runs from ${nzDate(a.effective_date)} to ${nzDate(a.expiry_date)}. Your signed copy is attached.`,
        "Kind regards,\nUB Freight Ltd",
      ]),
      attachment: { name, base64: b64 },
    });
    await event(a.id, "emailed", "system", { to: agentTo, cc: notice });
  } catch (e) {
    await event(a.id, "email_failed", "system", { error: String(e).slice(0, 200) });
  }
  return json({ ok: true });
}

async function opLink(req: Request, b: Record<string, any>) {
  const auth = req.headers.get("Authorization") ?? "";
  const user = createClient(URL_, ANON, { global: { headers: { Authorization: auth } } });
  const { data: staff } = await user.rpc("is_staff");
  if (staff !== true) return json({ error: "Staff only" }, 403);
  const { data: a } = await db.from("agency_agreements").select("ref, signed_pdf_key").eq("id", b.id).maybeSingle();
  if (!a?.signed_pdf_key) return json({ error: "No signed PDF yet" }, 404);
  return json({ url: await presign(a.signed_pdf_key, "GET", 600, { download: `UBF Agency Agreement ${a.ref} signed.pdf` }) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, any>;
    if (b.op === "send") return await opSend(req, b);
    if (b.op === "get") return await opGet(b);
    if (b.op === "sign") return await opSign(req, b);
    if (b.op === "file") return await opFile(b);
    if (b.op === "link") return await opLink(req, b);
    if (b.op === "create_link") return await opCreateLink(req, b);
    return json({ error: "unknown op" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
