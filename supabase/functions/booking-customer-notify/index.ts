// STAFF — send a booking update to the customer: email (Brevo), WhatsApp (approved template, opted-in only), portal message.
// Nothing sends without an explicit staff action. Every channel used is logged to booking_comms.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { cors, json, requireStaff } from "./staffGate.ts"
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("booking-customer-notify");

type Body = {
  booking_id: string
  subject: string
  title: string
  body: string
  category?: string
  email?: { to: string[]; cc?: string[] }
  whatsapp?: { contact_ids: string[] }
  portal?: boolean
}
type Result = { channel: string; ok: boolean; detail?: string }

const CATEGORIES = new Set(["documentation", "customs", "delivery", "collection", "follow_up", "customer_enquiry", "delay", "other"])
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!))
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
// WhatsApp template params: no newlines/tabs, no 4+ spaces, keep it short.
const waParam = (s: string, max: number) => s.replace(/[\r\n\t]+/g, " · ").replace(/ {2,}/g, " ").trim().slice(0, max)

function emailHtml(title: string, body: string, ref: string, staffName: string): string {
  const paras = esc(body).split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br>")}</p>`).join("")
  return `<!doctype html><html><body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#1a2233">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e3e7ed;border-radius:10px">
<tr><td style="padding:18px 24px;border-bottom:3px solid #0A2472"><span style="font-weight:700;color:#0A2472;font-size:16px">UB Freight</span>
<span style="float:right;color:#64708a;font-size:12px">Ref ${esc(ref)}</span></td></tr>
<tr><td style="padding:22px 24px 8px"><div style="font-size:18px;font-weight:700;color:#0A2472;margin-bottom:12px">${esc(title)}</div>
<div style="font-size:14px;line-height:1.55">${paras}</div>
<p style="margin:16px 0 0;font-size:14px">Kind regards,<br>${esc(staffName)}<br>UB Freight</p></td></tr>
<tr><td style="padding:14px 24px;color:#8a94a6;font-size:11px;border-top:1px solid #eef2f6">Reply to this email to reach your UB Freight contact.</td></tr>
</table></td></tr></table></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405)
  try {
    const gate = await requireStaff(req)
    if (!gate.ok) return gate.response
    const db = gate.db
    const userDb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    })

    const b = (await req.json().catch(() => ({}))) as Body
    const subject = (b.subject ?? "").trim(), title = (b.title ?? "").trim(), text = (b.body ?? "").trim()
    if (!b.booking_id || !subject || !title || !text) return json({ error: "booking_id, subject, title and body are required" }, 400)
    if (text.length > 4000) return json({ error: "Message is too long (4,000 characters max)" }, 400)
    if (!b.email?.to?.length && !b.whatsapp?.contact_ids?.length && !b.portal) return json({ error: "Pick at least one channel" }, 400)

    const { data: booking } = await db.from("bookings").select("id, booking_ref, account_id").eq("id", b.booking_id).maybeSingle()
    if (!booking) return json({ error: "Booking not found" }, 404)
    const ref = String(booking.booking_ref ?? "")
    const { data: staff } = await db.from("staff_users").select("email, full_name, first_name, initials").eq("user_id", gate.staffId).maybeSingle()
    const staffName = String(staff?.full_name || staff?.first_name || String(staff?.email ?? "").split("@")[0] || "UB Freight")
    const category = CATEGORIES.has(b.category ?? "") ? b.category! : "follow_up"
    const results: Result[] = []
    const log = async (activity: string, who: string, subj: string) => {
      await db.from("booking_comms").insert({
        booking_id: booking.id, activity_type: activity, direction: "outgoing", category,
        contact_name: who.slice(0, 300), subject: subj.slice(0, 300), body: text,
        created_by: gate.staffId, author_initials: staff?.initials ?? null,
      })
    }

    // 1. Email
    if (b.email?.to?.length) {
      const to = [...new Set(b.email.to.map((e) => e.trim()).filter(isEmail))]
      const cc = [...new Set((b.email.cc ?? []).map((e) => e.trim()).filter(isEmail))].filter((e) => !to.includes(e))
      const key = Deno.env.get("BREVO_API_KEY")
      if (!to.length) results.push({ channel: "email", ok: false, detail: "No valid email address" })
      else if (!key) results.push({ channel: "email", ok: false, detail: "BREVO_API_KEY not configured" })
      else {
        const from = Deno.env.get("BOOKING_FROM_EMAIL") ?? Deno.env.get("TMS_FROM_EMAIL") ?? "no-reply@ubfreight.com"
        const r = await apiFetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            sender: { email: from, name: "UB Freight" },
            replyTo: staff?.email ? { email: staff.email, name: staffName } : undefined,
            to: to.map((email) => ({ email })), ...(cc.length ? { cc: cc.map((email) => ({ email })) } : {}),
            subject, htmlContent: emailHtml(title, text, ref, staffName), textContent: `${title}\n\n${text}\n\n${staffName}\nUB Freight`,
          }),
        })
        const ok = r.ok
        results.push({ channel: "email", ok, detail: ok ? `Sent to ${to.join(", ")}` : `Brevo ${r.status}: ${(await r.text()).slice(0, 200)}` })
        if (ok) await log("email", [...to, ...cc].join(", "), subject)
      }
    }

    // 2. WhatsApp — approved template only, opted-in contacts of this account only
    if (b.whatsapp?.contact_ids?.length) {
      const { data: contacts } = await db.from("whatsapp_contacts").select("id, wa_id, display_name, account_id, opted_in")
        .in("id", b.whatsapp.contact_ids)
      const allowed = (contacts ?? []).filter((c) => c.opted_in && c.account_id === booking.account_id)
      if (!allowed.length) results.push({ channel: "whatsapp", ok: false, detail: "No opted-in WhatsApp contact for this customer" })
      const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      for (const c of allowed) {
        const first = String(c.display_name ?? "there").split(" ")[0] || "there"
        const r = await apiFetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${svc}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            to: c.wa_id, type: "template", related_booking_id: booking.id,
            template: { name: "ubf_shipment_update", language: "en_US",
              params: [waParam(first, 60), waParam(`${title} (${ref})`, 120), waParam(text, 900)] },
          }),
        })
        const ok = r.ok
        results.push({ channel: "whatsapp", ok, detail: ok ? `Sent to ${c.display_name ?? "contact"}` : `WhatsApp ${r.status}: ${(await r.text()).slice(0, 200)}` })
        if (ok) await log("im", `WhatsApp: ${c.display_name ?? c.wa_id}`, `WhatsApp: ${title}`)
      }
    }

    // 3. Portal message (customer sees it in the portal; their own notification settings decide email/WhatsApp alerts)
    if (b.portal) {
      const { data: threadId, error } = await userDb.rpc("staff_booking_message_post", {
        p_booking: booking.id, p_subject: subject, p_body: `${title}\n\n${text}`,
      })
      results.push({ channel: "portal", ok: !error, detail: error ? error.message : "Posted to portal" })
      if (!error) await log("note", "Customer portal", `Portal: ${title}`)
      if (!error && threadId) results[results.length - 1].detail = `Posted to portal (thread ${String(threadId).slice(0, 8)})`
    }

    return json({ ok: results.some((r) => r.ok), results })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
