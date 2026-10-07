// quote-reminder-send — STAFF. Emails customers a reminder for open quotes with one-click Accept / Decline links.
// Sends through Outlook (MS Graph) as the sales support shared mailbox, owner in CC. No Brevo.
// Body: { items: [{ quote_id, email? }] }  (email overrides the resolved contact). verify_jwt=true.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, json, requireStaff } from "../booking-customer-notify/staffGate.ts";
import { setApiFn } from "../_shared/apiFetch.ts";
import { graphToken } from "../email-inbox-sync/graph.ts";
import { sendAsMailbox } from "../booking-email-send/graphSend.ts";
import { renderCustomerReminder } from "../_shared/quoteEmail.ts";
import { isServiceCaller } from "../_shared/serviceAuth.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
setApiFn("quote-reminder-send");

const MAILBOX = Deno.env.get("QUOTE_REMINDER_MAILBOX") ?? "salessupport.nz@ubfreight.com";
const PORTAL = (Deno.env.get("PORTAL_URL") ?? "https://portal.ubfreight.com").replace(/\/+$/, "");
const MAX = 50;
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const LIVE = ["open", "published", "sent"];

type Item = { quote_id?: string; email?: string | null };
type Result = { quote_id: string; quote_no?: string | null; ok: boolean; to?: string; error?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    // Staff JWT normally. Service key allowed for admin tests (as_staff + allow_internal).
    const body = (await req.json().catch(() => ({}))) as { items?: Item[]; as_staff?: string; allow_internal?: boolean };
    let gate: { staffId: string; db: ReturnType<typeof createClient> };
    let internalOk = false;
    if (await isServiceCaller(req)) {
      if (!body.as_staff) return json({ error: "as_staff required" }, 400);
      gate = { staffId: body.as_staff, db: createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!) };
      internalOk = !!body.allow_internal;
    } else {
      const g = await requireStaff(req);
      if (!g.ok) return g.response;
      gate = g;
    }
    const db = gate.db;
    const items = (body.items ?? []).filter((i) => i.quote_id).slice(0, MAX);
    if (!items.length) return json({ error: "No quotes selected" }, 400);

    const token = await graphToken();
    const results: Result[] = [];

    for (const it of items) {
      const qid = it.quote_id!;
      try {
        const { data: q } = await db.from("quotes")
          .select("id, quote_no, status, shipment_type, customer_name, customer_account_id, contact_name, from_port_code, to_port_code, expires_at, created_by")
          .eq("id", qid).maybeSingle();
        if (!q) { results.push({ quote_id: qid, ok: false, error: "Quote not found" }); continue; }
        if (!LIVE.includes(q.status)) { results.push({ quote_id: qid, quote_no: q.quote_no, ok: false, error: `Quote is ${q.status}` }); continue; }

        let to = (it.email ?? "").trim().toLowerCase();
        if (!to) {
          const { data: e } = await db.rpc("quote_contact_email", { p_quote: qid });
          to = String(e ?? "").trim().toLowerCase();
        }
        if (!isEmail(to)) { results.push({ quote_id: qid, quote_no: q.quote_no, ok: false, error: "No customer email" }); continue; }
        if (to.endsWith("@ubfreight.com") && !internalOk) { results.push({ quote_id: qid, quote_no: q.quote_no, ok: false, error: "Email is a UBF address" }); continue; }

        const { data: opts } = await db.from("quote_responses")
          .select("id, carrier, transit_time_days, total_sell, currency, valid_till, status")
          .eq("quote_id", qid).gt("total_sell", 0).not("status", "in", "(rejected,withdrawn)").order("total_sell");
        if (!opts?.length) { results.push({ quote_id: qid, quote_no: q.quote_no, ok: false, error: "No priced options" }); continue; }

        const codes = [q.from_port_code, q.to_port_code].filter(Boolean) as string[];
        const { data: ports } = codes.length ? await db.from("ports").select("code, name").in("code", codes) : { data: [] };
        const pn = (c: string | null) => (c ? ports?.find((p) => p.code === c)?.name ?? c : "?");
        const lane = `${pn(q.from_port_code)} to ${pn(q.to_port_code)}`;

        const { data: owner } = q.created_by
          ? await db.from("staff_users").select("full_name, email").eq("user_id", q.created_by).maybeSingle()
          : { data: null };
        let contactName = q.contact_name as string | null;
        if (!contactName && q.customer_account_id) {
          const { data: c } = await db.from("contacts").select("first_name, email").eq("account_id", q.customer_account_id)
            .ilike("email", to).limit(1).maybeSingle();
          contactName = c?.first_name ?? null;
        }

        const { data: rm, error: rmErr } = await db.from("quote_reminders")
          .insert({ quote_id: qid, sent_to: to, sent_by: gate.staffId, mailbox: MAILBOX }).select("id, token").single();
        if (rmErr || !rm) throw new Error(rmErr?.message ?? "Could not create link");

        const base = `${PORTAL}/q/${rm.token}`;
        const mail = renderCustomerReminder({
          contactName, customerName: q.customer_name, quoteNo: q.quote_no ?? "", lane, expiresAt: q.expires_at,
          // LCL co-loaders are never shown to customers.
          options: opts.map((o) => ({ carrier: String(q.shipment_type ?? '').toUpperCase() === 'LCL' ? null : o.carrier, transit_days: o.transit_time_days, total: o.total_sell, currency: o.currency, valid_till: o.valid_till })),
          acceptUrl: `${base}?a=accept&r=${opts[0].id}`, declineUrl: `${base}?a=decline`, viewUrl: base,
          ownerName: owner?.full_name ?? null, ownerEmail: owner?.email ?? null,
        });
        const cc = owner?.email && owner.email.toLowerCase() !== to ? [owner.email.toLowerCase()] : [];
        try {
          await sendAsMailbox(token, MAILBOX, { subject: mail.subject, html: mail.html, to: [to], cc, attachments: [] });
        } catch (e) {
          const msg = /ErrorAccessDenied|403/.test(String(e)) ? `Portal cannot send from ${MAILBOX} yet (Mail.Send access)` : String(e).slice(0, 200);
          await db.from("quote_reminders").update({ error: msg }).eq("id", rm.id);
          results.push({ quote_id: qid, quote_no: q.quote_no, ok: false, to, error: msg });
          continue;
        }
        await db.from("quotes").update({ last_reminded_at: new Date().toISOString() }).eq("id", qid);
        await db.rpc("email_contacts_touch", { p_emails: [to], p_kind: "customer" }).then(() => null, () => null);
        results.push({ quote_id: qid, quote_no: q.quote_no, ok: true, to });
      } catch (e) {
        results.push({ quote_id: qid, ok: false, error: String(e).slice(0, 200) });
      }
    }
    return json({ ok: true, from: MAILBOX, sent: results.filter((r) => r.ok).length, results });
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
