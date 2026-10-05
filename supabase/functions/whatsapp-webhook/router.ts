// router.ts — inbound intent routing.
// - opt-out/opt-in keywords (STOP/START)
// - CSAT rating reply (1-5) when a whatsapp csat_request is pending for this sender
// - tracking fast-path (deterministic ref/container detect) with strict account gate
// - unbound sender: generic ack once, flagged + team bell alert (once per contact per NZ day)
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const GRAPH = "https://graph.facebook.com/v25.0";

type Booking = {
  id: string; booking_ref: string | null;
  account_id: string | null; importer_account_id: string | null;
  consignee_account_id: string | null; os_agent_account_id: string | null;
  origin: string | null; destination: string | null;
  vessel: string | null; voyage: string | null; shipping_line_code: string | null;
  eta: string | null; m_eta: string | null; etd: string | null;
  last_free_day: string | null; discharge_date: string | null;
  delivery_date: string | null; container_return_date: string | null;
  swb_released: boolean | null; tlx_release_on_hand: boolean | null;
  bacc_sent: boolean | null; cleared: boolean | null; truck_booked: boolean | null;
  hold_reason: string | null; mbl_no: string | null; status: string | null;
};

const BOOKING_COLS =
  "id,booking_ref,account_id,importer_account_id,consignee_account_id,os_agent_account_id," +
  "origin,destination,vessel,voyage,shipping_line_code,eta,m_eta,etd," +
  "last_free_day,discharge_date,delivery_date,container_return_date," +
  "swb_released,tlx_release_on_hand,bacc_sent,cleared,truck_booked,hold_reason,mbl_no,status";

export function extractBookingRef(text: string): string | null {
  const m = text.toUpperCase().match(/UBF-[A-Z]{2}-\d{2}-\d{3,4}/);
  return m ? m[0] : null;
}
export function extractContainer(text: string): string | null {
  const m = text.toUpperCase().match(/\b[A-Z]{4}\d{7}\b/);
  return m ? m[0] : null;
}

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  const dt = new Date(d.length <= 10 ? d + "T00:00:00Z" : d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-NZ", { day: "2-digit", month: "short", year: "numeric", timeZone: "Pacific/Auckland" });
}
function flag(b: boolean | null): string { return b ? "\u2705" : "\u2b1c"; }

export function buildMilestoneSummary(b: Booking): string {
  const lines: string[] = [];
  lines.push(`\ud83d\udce6 *${b.booking_ref ?? "Shipment"}*`);
  if (b.origin || b.destination) lines.push(`${b.origin ?? "?"} \u2192 ${b.destination ?? "?"}`);
  const vessel = [b.vessel, b.voyage].filter(Boolean).join(" / ");
  if (vessel) lines.push(`Vessel: ${vessel}${b.shipping_line_code ? ` (${b.shipping_line_code})` : ""}`);
  else if (b.shipping_line_code) lines.push(`Line: ${b.shipping_line_code}`);
  if (b.mbl_no) lines.push(`MBL: ${b.mbl_no}`);

  lines.push("", "*Status*");
  lines.push(`${flag(b.swb_released)} SWB released`);
  lines.push(`${flag(b.tlx_release_on_hand)} Telex release`);
  lines.push(`${flag(b.bacc_sent)} Customs (BACC)`);
  lines.push(`${flag(b.cleared)} Cleared`);
  lines.push(`${flag(b.truck_booked)} Transport booked`);

  const dates: string[] = [];
  const eta = fmtDate(b.eta ?? b.m_eta); if (eta) dates.push(`ETA: ${eta}`);
  const disc = fmtDate(b.discharge_date); if (disc) dates.push(`Discharged: ${disc}`);
  const lfd = fmtDate(b.last_free_day); if (lfd) dates.push(`Last free day: ${lfd}`);
  const del = fmtDate(b.delivery_date); if (del) dates.push(`Delivered: ${del}`);
  const ret = fmtDate(b.container_return_date); if (ret) dates.push(`Container returned: ${ret}`);
  if (dates.length) lines.push("", ...dates);

  if (b.hold_reason) lines.push("", `\u26a0\ufe0f On hold: ${b.hold_reason}`);
  lines.push("", "_Reply here and our team will assist further._");
  return lines.join("\n");
}

async function findBookingByRef(sb: SupabaseClient, ref: string): Promise<Booking | null> {
  const { data } = await sb.from("bookings").select(BOOKING_COLS).ilike("booking_ref", ref).limit(1).maybeSingle();
  return (data as Booking) ?? null;
}
async function findBookingByContainer(sb: SupabaseClient, cnt: string): Promise<Booking | null> {
  const { data: ev } = await sb.from("tracking_events").select("booking_id")
    .ilike("container_no", cnt).not("booking_id", "is", null).limit(1).maybeSingle();
  if (!ev?.booking_id) return null;
  const { data } = await sb.from("bookings").select(BOOKING_COLS).eq("id", ev.booking_id).maybeSingle();
  return (data as Booking) ?? null;
}

async function sendText(
  sb: SupabaseClient, token: string, phoneId: string, to: string, textBody: string, bookingId?: string,
) {
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: textBody, preview_url: false } }),
  });
  const data = await res.json().catch(() => ({}));
  const waMsgId = data?.messages?.[0]?.id ?? null;
  const { data: c } = await sb.from("whatsapp_contacts").select("id").eq("wa_id", to).maybeSingle();
  if (c?.id) {
    await sb.from("whatsapp_messages").insert({
      wa_message_id: waMsgId, contact_id: c.id, direction: "outbound", msg_type: "text",
      body: textBody, related_booking_id: bookingId ?? null,
      status: res.ok ? "sent" : "failed", raw: { response: data },
    });
  }
}

async function setOptIn(sb: SupabaseClient, contactId: string, val: boolean) {
  await sb.from("whatsapp_contacts")
    .update({ opted_in: val, opted_in_at: val ? new Date().toISOString() : null })
    .eq("id", contactId);
}

async function maybeNudge(sb: SupabaseClient, token: string, phoneId: string, msg: { contact_id: string; wa_id: string }) {
  const { count } = await sb.from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", msg.contact_id).eq("direction", "outbound");
  if ((count ?? 0) > 0) return; // already contacted this number
  await sendText(sb, token, phoneId, msg.wa_id,
    "Thanks for messaging UB Freight. A team member will get back to you shortly.");
}

// Team bell alert (user_id null = all staff). One per contact per NZ day via dedupe_key.
async function alertStaffUnknown(sb: SupabaseClient, msg: { contact_id: string; wa_id: string; body: string | null }) {
  const { data: c } = await sb.from("whatsapp_contacts").select("display_name").eq("id", msg.contact_id).maybeSingle();
  const who = c?.display_name ? `${c.display_name} (+${msg.wa_id})` : `+${msg.wa_id}`;
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
  const text = (msg.body ?? "").replace(/\s+/g, " ").trim();
  const { error } = await sb.from("staff_notifications").insert({
    user_id: null, kind: "whatsapp_inbound", actor_kind: "customer",
    title: `WhatsApp from unknown number: ${who}`,
    body: text ? (text.length > 160 ? text.slice(0, 157) + "..." : text) : "(media message)",
    link: "/whatsapp", facts: { wa_id: msg.wa_id, contact_id: msg.contact_id },
    dedupe_key: `wa_unknown:${msg.contact_id}:${day}`,
  });
  if (error && error.code !== "23505") console.error("staff alert failed", error);
}

// CSAT: if the sender has a pending whatsapp csat_request and replies with 1-5, capture it.
async function maybeHandleCsatReply(
  sb: SupabaseClient, token: string, phoneId: string,
  msg: { id: string; wa_id: string; body: string | null },
): Promise<boolean> {
  const body = (msg.body ?? "").trim();
  const m = body.match(/^([1-5])(?:\D|$)/);
  if (!m) return false;
  const { data: reqRow } = await sb.from("csat_requests")
    .select("id, token, booking_id")
    .eq("channel", "whatsapp").eq("recipient_wa_id", msg.wa_id).eq("status", "sent")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!reqRow?.token) return false;
  const score = parseInt(m[1], 10);
  const comment = body.replace(/^\s*[1-5]\s*[\.\)\-:]?\s*/, "").trim() || null;
  try {
    await sb.rpc("csat_submit", { p_score: score, p_token: reqRow.token, p_comment: comment });
  } catch (e) { console.error("csat_submit failed", e); }
  await sendText(sb, token, phoneId, msg.wa_id,
    score >= 4
      ? "Thank you for the great feedback! \u{1F64F}"
      : "Thanks for your feedback \u2014 we\u2019ll use it to improve. A team member may follow up.",
    reqRow.booking_id ?? undefined);
  await sb.from("whatsapp_messages")
    .update({ intent: "csat", status: "answered", related_booking_id: reqRow.booking_id ?? null })
    .eq("id", msg.id);
  return true;
}

export async function routeInbound(
  sb: SupabaseClient, token: string, phoneId: string,
  msg: { id: string; contact_id: string; wa_id: string; body: string | null },
) {
  const body = (msg.body ?? "").trim();

  if (/^(stop|unsubscribe|opt\s*out)$/i.test(body)) {
    await setOptIn(sb, msg.contact_id, false);
    await sendText(sb, token, phoneId, msg.wa_id, "You're unsubscribed from UB Freight WhatsApp updates. Reply START to opt back in.");
    await sb.from("whatsapp_messages").update({ intent: "optout", status: "answered" }).eq("id", msg.id);
    return;
  }
  if (/^(start|unstop|resume)$/i.test(body)) {
    await setOptIn(sb, msg.contact_id, true);
    await sendText(sb, token, phoneId, msg.wa_id, "You're subscribed to UB Freight WhatsApp updates again. Reply STOP to opt out.");
    await sb.from("whatsapp_messages").update({ intent: "optin", status: "answered" }).eq("id", msg.id);
    return;
  }

  // CSAT rating reply (before tracking/other routing)
  if (await maybeHandleCsatReply(sb, token, phoneId, { id: msg.id, wa_id: msg.wa_id, body })) return;

  const { data: contact } = await sb.from("whatsapp_contacts").select("account_id").eq("id", msg.contact_id).maybeSingle();
  const accountId = contact?.account_id ?? null;

  const ref = extractBookingRef(body);
  const cnt = ref ? null : extractContainer(body);

  // Unbound sender: never disclose shipment status. Nudge once, flag for staff.
  if (!accountId) {
    await maybeNudge(sb, token, phoneId, msg);
    await alertStaffUnknown(sb, { contact_id: msg.contact_id, wa_id: msg.wa_id, body });
    await sb.from("whatsapp_messages").update({ intent: ref || cnt ? "tracking" : "other", status: "flagged" }).eq("id", msg.id);
    return;
  }

  if (!ref && !cnt) return; // bound, non-tracking; left for booking/quote routing (next step)

  const booking = ref ? await findBookingByRef(sb, ref) : await findBookingByContainer(sb, cnt!);
  const owned = !!booking && [
    booking.account_id, booking.importer_account_id, booking.consignee_account_id, booking.os_agent_account_id,
  ].includes(accountId);

  if (!booking || !owned) {
    await sendText(sb, token, phoneId, msg.wa_id,
      `We couldn't find *${ref ?? cnt}* on your account. Our team will take a look and follow up.`);
    await sb.from("whatsapp_messages").update({ intent: "tracking", status: "flagged" }).eq("id", msg.id);
    return;
  }

  await sendText(sb, token, phoneId, msg.wa_id, buildMilestoneSummary(booking), booking.id);
  await sb.from("whatsapp_messages").update({ intent: "tracking", status: "answered", related_booking_id: booking.id }).eq("id", msg.id);
}
