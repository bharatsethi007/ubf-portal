// collections-email-send — STAFF + finance permission. Payment reminder / statement through Outlook (MS Graph)
// from the collections mailbox (finance.settings.collections_mailbox). Logs the email in finance.collection_actions.
// Self-contained (no shared imports). Body: { accountid, to[], cc?[], subject, text, invoices?: string[] (numbers to list; default all open) }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nzDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-NZ", { timeZone: "Pacific/Auckland", day: "numeric", month: "short", year: "numeric" }) : "";
const GRAPH = "https://graph.microsoft.com/v1.0";

async function graphToken(): Promise<string> {
  const tenant = Deno.env.get("MS_TENANT_ID"), id = Deno.env.get("MS_CLIENT_ID"), secret = Deno.env.get("MS_CLIENT_SECRET");
  if (!tenant || !id || !secret) throw new Error("Missing MS Graph env vars");
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`Graph token failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token as string;
}

// sendMail saves to the mailbox's Sent Items.
async function sendAsMailbox(token: string, mailbox: string, m: { subject: string; html: string; to: string[]; cc: string[] }) {
  const rcpt = (l: string[]) => l.map((address) => ({ emailAddress: { address } }));
  const res = await fetch(`${GRAPH}/users/${encodeURIComponent(mailbox)}/sendMail`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { subject: m.subject, body: { contentType: "HTML", content: m.html },
      toRecipients: rcpt(m.to), ccRecipients: rcpt(m.cc) }, saveToSentItems: true }),
  });
  if (!res.ok) throw new Error(`Graph sendMail ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const clean = (l?: string[]) => [...new Set((l ?? []).map((e) => e.trim().toLowerCase()).filter(isEmail))];
const nz = (n: number) => Number(n).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Inv = { number: string; doc_date: string; datedue: string | null; days_over: number; amount: number; balance: number; job_no: number | null; currency: string | null };
type Body = { accountid?: string; to?: string[]; cc?: string[]; subject?: string; text?: string; invoices?: string[] };

function render(text: string, name: string, invs: Inv[]): string {
  const paras = text.trim().split(/\n{2,}/).map((b) =>
    `<p style="margin:0 0 12px;font-family:${FONT};font-size:14px;line-height:21px;color:#111827;">${esc(b).replace(/\n/g, "<br>")}</p>`).join("");
  const th = (t: string, r = false) => `<td style="padding:7px 9px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;font-family:${FONT};font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#64748B;${r ? "text-align:right;" : ""}">${t}</td>`;
  const td = (t: string, r = false, red = false) => `<td style="padding:8px 9px;border-bottom:1px solid #E2E8F0;font-family:${FONT};font-size:13px;color:${red ? "#B91C1C" : "#111827"};${r ? "text-align:right;white-space:nowrap;" : ""}">${t}</td>`;
  const rows = invs.map((i) => `<tr>${td(esc(i.number))}${td(esc(nzDate(i.doc_date)))}${td(esc(nzDate(i.datedue ?? i.doc_date)))}${td(i.days_over > 0 ? `${i.days_over} days` : "Not yet due", true, i.days_over > 30)}${td(nz(i.balance), true)}</tr>`).join("");
  const total = invs.reduce((a, i) => a + Number(i.balance), 0);
  const table = invs.length ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E2E8F0;border-radius:6px;margin:6px 0 16px;min-width:460px;">
<tr>${th("Invoice")}${th("Date")}${th("Due")}${th("Overdue", true)}${th("Balance NZD", true)}</tr>${rows}
<tr><td colspan="4" style="padding:9px;font-family:${FONT};font-size:13px;font-weight:600;color:#111827;">Total outstanding for ${esc(name)}</td>
<td style="padding:9px;text-align:right;font-family:${FONT};font-size:13px;font-weight:600;color:#111827;white-space:nowrap;">${nz(total)}</td></tr></table>` : "";
  return `<div style="font-family:${FONT};">${paras}${table}</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const b = (await req.json().catch(() => ({}))) as Body;
    const to = clean(b.to), cc = clean(b.cc).filter((e) => !to.includes(e));
    if (!b.accountid) return json({ error: "accountid required" }, 400);
    if (!to.length) return json({ error: "Add at least one valid To address" }, 400);
    if (!(b.subject ?? "").trim()) return json({ error: "Subject is required" }, 400);
    if (!(b.text ?? "").trim()) return json({ error: "Message is empty" }, 400);

    // Caller's own JWT: finance RPCs enforce staff + has_perm('finance','read').
    const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: led, error: le } = await user.rpc("fin_customer_ledger", { p_accountid: b.accountid });
    if (le) return json({ error: le.message.includes("Finance access") ? "Finance access required" : le.message }, 403);
    const ledger = led as { name: string | null; invoices: Inv[]; mailbox: string | null };
    const pick = b.invoices?.length ? new Set(b.invoices) : null;
    const invs = (ledger.invoices ?? []).filter((i) => !pick || pick.has(i.number));
    const mailbox = ledger.mailbox || "accounts.nz@ubfreight.com";
    const html = render(b.text!, ledger.name ?? b.accountid, invs);

    try {
      const token = await graphToken();
      await sendAsMailbox(token, mailbox, { subject: b.subject!.trim(), html, to, cc });
    } catch (e) {
      const msg = String(e);
      const friendly = /ErrorAccessDenied|403|MailboxNotEnabled|ResourceNotFound|404/.test(msg)
        ? `Portal cannot send from ${mailbox} yet. Ask IT to grant the portal app Mail.Send on that mailbox.` : msg.slice(0, 300);
      return json({ error: friendly }, 502);
    }

    await user.rpc("fin_collection_log", {
      p_accountid: b.accountid, p_kind: "email", p_body: `${b.subject!.trim()}\n\n${b.text!.trim()}`,
      p_invoices: invs.map((i) => i.number), p_email_to: [...to, ...cc],
    });
    return json({ ok: true, from: mailbox, to, cc, invoices: invs.length });
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
