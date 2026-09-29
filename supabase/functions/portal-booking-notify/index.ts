// Portal booking emails. Called by the bookings trigger through pg_net (service role).
//   new_request            -> module inbox (Import Sea, Export Air, ...), reply-to the requester
//   quote_request          -> module inbox for a portal quote request (booking_id carries the quote id)
//   quote_approved|quote_rejected -> module inbox + sender, customer answered a quote (booking_id carries the response id)
//   confirmed|declined|in_erp -> the customer who asked, reply-to the module inbox
// Each email goes once per booking and event (portal_booking_notifications).
// POST { booking_id, event, dry?: true } — dry returns the rendered email without sending.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { renderNotify, type Fact, type NotifyEmail } from "./notifyEmail.ts";
import { quoteDecisionAlert } from "./quoteDecision.ts";

const CONSOLE_URL = "https://console.ubfreight.com";
const PORTAL_URL = Deno.env.get("PORTAL_PUBLIC_URL") ?? "https://portal.ubfreight.com";

const INBOX: Record<string, { email: string; team: string }> = {
  IS: { email: "importsea.nz@ubfreight.com", team: "Import Sea" },
  ES: { email: "exportsea.nz@ubfreight.com", team: "Export Sea" },
  IA: { email: "importair.nz@ubfreight.com", team: "Import Air" },
  EA: { email: "exportair.nz@ubfreight.com", team: "Export Air" },
};
const FALLBACK = { email: "info.nz@ubfreight.com", team: "UB Freight" };

type Payload = Record<string, any>;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

function jwtRole(auth: string | null): string | null {
  try {
    const tok = (auth ?? "").replace(/^Bearer\s+/i, "");
    return JSON.parse(atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? null;
  } catch { return null; }
}

// Legacy service_role JWT, or a new sb_secret_ key proven by an RPC only service_role may run.
async function isServiceCaller(auth: string | null, bookingId: string): Promise<boolean> {
  if (jwtRole(auth) === "service_role") return true;
  const tok = (auth ?? "").replace(/^Bearer\s+/i, "");
  if (!tok.startsWith("sb_secret_")) return false;
  const probe = createClient(Deno.env.get("SUPABASE_URL")!, tok, { auth: { persistSession: false } });
  const { error } = await probe.rpc("portal_booking_notify_payload", { p_booking: bookingId });
  return !error;
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};
const titleCase = (s?: string | null) => (s ? s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()) : null);
const num = (v: unknown, unit: string) => (v == null || v === "" ? null : `${Number(v).toLocaleString("en-NZ")} ${unit}`);

function modeLabel(b: Payload): string {
  const sea = b.module === "IS" || b.module === "ES";
  const dir = b.module?.startsWith("I") ? "Import" : "Export";
  return `${dir} ${sea ? `sea${b.load_type ? ` ${b.load_type}` : ""}` : "air"}`;
}

function cargoFacts(b: Payload): Fact[] {
  const boxes = b.container_count ? `${b.container_count} x ${b.container_type ?? "container"}` : null;
  const flags = [b.is_dg ? "Dangerous goods" : null, b.is_temp ? "Temperature controlled" : null].filter(Boolean).join(", ");
  return [
    ["Route", `${b.origin ?? "?"} to ${b.destination ?? "?"}`],
    ["Service", modeLabel(b)],
    ["Cargo ready", fmtDate(b.cargo_ready_date)],
    ["Preferred ETD", fmtDate(b.etd)],
    ["Goods", b.goods],
    ["Containers", boxes],
    ["Pieces", b.pieces ? `${b.pieces}${b.packing ? ` ${b.packing}` : ""}` : null],
    ["Weight", num(b.weight_kg, "kg")],
    ["Volume", num(b.cbm, "m³")],
    ["Incoterm", b.incoterm],
    ["Flags", flags || null],
    ["Your reference", b.customer_ref],
  ];
}

function staffAlert(b: Payload): { to: string; replyTo?: string; subject: string; email: NotifyEmail } {
  const box = INBOX[b.module] ?? FALLBACK;
  const who = titleCase(b.customer_name) ?? b.account_id ?? "A customer";
  const dup = b.duplicate && b.duplicate.score >= 60 ? b.duplicate : null;
  const facts = cargoFacts(b).map(([k, v]) => [k === "Your reference" ? "Customer PO / ref" : k, v] as Fact);
  return {
    to: Deno.env.get("PORTAL_BOOKING_ALERT_TO") || box.email,
    replyTo: b.requester_email ?? undefined,
    subject: `New portal booking ${b.booking_ref}: ${who}, ${b.origin} to ${b.destination}`,
    email: {
      preheader: `${who} requested ${modeLabel(b).toLowerCase()} ${b.origin} to ${b.destination}.`,
      eyebrow: `${box.team} · Portal booking request`,
      title: `${b.booking_ref} from ${who}`,
      intro: [
        `${b.requester_email ? `${b.requester_email} at ` : ""}${who} asked for this booking through the customer portal.`,
        `Confirm or decline it in the console. When you key it into CyberFreight, put <b>${b.booking_ref}</b> in the booking reference so the shipment links back automatically.`,
      ],
      callout: dup
        ? { tone: "amber", text: `Possible duplicate: ERP shipment <b>${dup.consol_key ?? dup.job_unique}</b> already matches this booking (${(dup.reasons ?? []).join(", ")}). Link it instead of creating a new job.` }
        : null,
      facts: [["Customer", `${who}${b.account_id ? ` (${b.account_id})` : ""}`], ["Booked at rate", rateLine(b.quoted_rate)], ...facts, ["Notes", b.notes]],
      button: { label: "Review in console", url: `${CONSOLE_URL}/bookings/${b.id}` },
      footer: "Sent to the team inbox when a customer submits a booking on portal.ubfreight.com. Reply to reach the customer.",
    },
  };
}

function rateLine(r: Payload | null | undefined): string | null {
  if (!r?.sell) return null
  const unit = r.product === "FCL" ? `per ${r.container_type ?? "container"}` : r.product === "LCL" ? "per W/M" : "per kg"
  return `${r.currency} ${Number(r.sell).toLocaleString("en-NZ")} ${unit} · ${r.carrier ?? "carrier"}${r.valid_to ? ` · valid to ${fmtDate(r.valid_to)}` : ""}`
}

const NZ_AIRPORTS = new Set(["AKL", "CHC", "WLG", "ZQN", "DUD", "NSN", "PMR", "NPE", "HLZ", "IVC"])
function moduleOf(q: Payload): string {
  const dest = String(q.destination ?? "").toUpperCase()
  const imp = q.direction ? q.direction === "import" : (q.mode === "air" ? NZ_AIRPORTS.has(dest) : dest.startsWith("NZ"))
  return q.mode === "air" ? (imp ? "IA" : "EA") : (imp ? "IS" : "ES")
}

function quoteAlert(q: Payload): { to: string; replyTo?: string; subject: string; email: NotifyEmail } {
  const box = INBOX[moduleOf(q)] ?? FALLBACK
  const who = titleCase(q.customer_name) ?? q.account_id ?? "A customer"
  const boxes = q.container_count || q.container_type ? `${q.container_count ?? 1} x ${q.container_type ?? "container"}` : null
  return {
    to: Deno.env.get("PORTAL_BOOKING_ALERT_TO") || box.email,
    replyTo: q.requester_email ?? undefined,
    subject: `Quote request ${q.quote_no}: ${who}, ${q.origin} to ${q.destination}`,
    email: {
      preheader: `${who} asked for a price on ${q.origin} to ${q.destination}.`,
      eyebrow: `${box.team} · Portal quote request`,
      title: `${q.quote_no} from ${who}`,
      intro: [
        `${q.requester_email ? `${q.requester_email} at ` : ""}${who} searched rates on the portal and asked for a quote on a lane without a published price.`,
        "It's in Quotes as an open quote. Price it there and send it back.",
      ],
      callout: null,
      facts: [
        ["Customer", `${who}${q.account_id ? ` (${q.account_id})` : ""}`],
        ["Route", `${q.origin} to ${q.destination}`],
        ["Service", `${q.direction === "import" ? "Import" : q.direction === "export" ? "Export" : ""} ${q.mode === "air" ? "air" : `sea ${q.type ?? ""}`}`.trim()],
        ["Cargo ready", fmtDate(q.ready)],
        ["Goods", q.goods],
        ["Containers", boxes],
        ["Weight", num(q.weight_kg, "kg")],
        ["Volume", num(q.cbm, "m³")],
        ["Flags", [q.is_dg ? "Dangerous goods" : null, q.is_temp ? "Temperature controlled" : null].filter(Boolean).join(", ") || null],
        ["Customer ref", q.customer_ref],
        ["Notes", q.notes],
      ],
      button: { label: "Open quote", url: `${CONSOLE_URL}/quotes/${q.id}` },
      footer: "Sent to the team inbox when a customer asks for a quote on portal.ubfreight.com. Reply to reach the customer.",
    },
  }
}

function customerUpdate(b: Payload, event: string): { to: string; replyTo?: string; subject: string; email: NotifyEmail } | null {
  if (!b.requester_email) return null;
  const box = INBOX[b.module] ?? FALLBACK;
  const route = `${b.origin} to ${b.destination}`;
  const common = { replyTo: box.email, to: b.requester_email as string };
  const footer = `Reply to this email to reach our ${box.team} team.`;
  if (event === "confirmed") return { ...common, subject: `Booking ${b.booking_ref} confirmed`, email: {
    preheader: `We have confirmed your ${route} booking.`, eyebrow: "Booking confirmed", title: `We've got your booking, ${b.booking_ref}`,
    intro: ["Thanks for booking with UB Freight. Our team has confirmed your request and is arranging space. You'll get another email once the shipment is live and trackable."],
    callout: null, facts: [["Booking", b.booking_ref], ...cargoFacts(b)],
    button: { label: "View your bookings", url: `${PORTAL_URL}/portal/bookings` }, footer } };
  if (event === "declined") return { ...common, subject: `Booking ${b.booking_ref}: we couldn't accept this one`, email: {
    preheader: `An update on your ${route} booking request.`, eyebrow: "Booking update", title: `We couldn't accept ${b.booking_ref}`,
    intro: ["Thanks for your request. Unfortunately we can't take this booking as submitted."],
    callout: b.decline_reason ? { tone: "red", text: `Reason: ${b.decline_reason}` } : null,
    facts: [["Booking", b.booking_ref], ...cargoFacts(b)],
    button: { label: "Request another booking", url: `${PORTAL_URL}/portal/bookings/new` }, footer } };
  if (event === "in_erp" && b.shipment) return { ...common, subject: `Booking ${b.booking_ref} is now shipment ${b.shipment.number}`, email: {
    preheader: `Track ${b.shipment.number} live in the portal.`, eyebrow: "Shipment created", title: `Your booking is now shipment ${b.shipment.number}`,
    intro: [`Your booking ${b.booking_ref} is now a live shipment. Track it, see documents and invoices in the portal.`],
    callout: null, facts: [["Shipment", b.shipment.number], ["Booking", b.booking_ref], ...cargoFacts(b)],
    button: { label: "Track shipment", url: `${PORTAL_URL}/portal/shipments/${encodeURIComponent(`#${b.shipment.job_unique}`)}` }, footer } };
  return null;
}

async function send(to: string, replyTo: string | undefined, senderName: string, subject: string, e: NotifyEmail): Promise<boolean> {
  const key = Deno.env.get("BREVO_API_KEY");
  if (!key) { console.error("BREVO_API_KEY not set"); return false; }
  const from = Deno.env.get("STAFF_INVITE_FROM_EMAIL") ?? "no-reply@ubfreight.com";
  const { html, text } = renderNotify(e);
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: from, name: senderName }, to: to.split(",").map((x) => ({ email: x.trim() })),
      ...(replyTo ? { replyTo: { email: replyTo } } : {}), subject, htmlContent: html, textContent: text,
    }),
  });
  if (!r.ok) console.error("brevo", r.status, await r.text());
  return r.ok;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const bookingId = String(body?.booking_id ?? "");
    const event = String(body?.event ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return json({ error: "booking_id required" }, 400);
    if (!(await isServiceCaller(req.headers.get("Authorization"), bookingId))) return json({ error: "forbidden" }, 403);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const isQuote = event === "quote_request";
    const isDecision = event === "quote_approved" || event === "quote_rejected";
    const { data: b, error } = isDecision
      ? await admin.rpc("portal_quote_decision_payload", { p_response: bookingId })
      : isQuote
      ? await admin.rpc("portal_quote_notify_payload", { p_quote: bookingId })
      : await admin.rpc("portal_booking_notify_payload", { p_booking: bookingId });
    if (error) throw error;
    if (!b) return json({ skipped: "not found" });

    const isStaff = event === "new_request" || isQuote || isDecision;
    const msg = isDecision ? quoteDecisionAlert(b) : isQuote ? quoteAlert(b) : event === "new_request" ? staffAlert(b) : customerUpdate(b, event);
    if (!msg) return json({ skipped: `nothing to send for ${event}` });
    if (body?.dry) return json({ dry: true, to: msg.to, replyTo: msg.replyTo, subject: msg.subject, text: renderNotify(msg.email).text });

    if ((b.sent ?? []).includes(event)) return json({ skipped: `${event} already sent` });

    const sent = await send(msg.to, msg.replyTo, isStaff ? "UBF Portal" : "UB Freight", msg.subject, msg.email);
    if (sent && !isQuote && !isDecision) await admin.from("portal_booking_notifications").insert({ booking_id: bookingId, event, recipient: msg.to });
    return json({ event, to: msg.to, sent });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
