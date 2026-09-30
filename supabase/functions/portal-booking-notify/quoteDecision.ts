// Staff email when a customer approves or rejects a quote in the portal.
import type { NotifyEmail } from "./notifyEmail.ts";

type Payload = Record<string, any>;

const CONSOLE_URL = "https://console.ubfreight.com";
const NZ_AIRPORTS = new Set(["AKL", "CHC", "WLG", "ZQN", "DUD", "NSN", "PMR", "NPE", "HLZ", "IVC"]);
const INBOX: Record<string, { email: string; team: string }> = {
  IS: { email: "importsea.nz@ubfreight.com", team: "Import Sea" },
  ES: { email: "exportsea.nz@ubfreight.com", team: "Export Sea" },
  IA: { email: "importair.nz@ubfreight.com", team: "Import Air" },
  EA: { email: "exportair.nz@ubfreight.com", team: "Export Air" },
};

function inboxOf(q: Payload): { email: string; team: string } {
  const dest = String(q.destination ?? "").toUpperCase();
  const imp = q.direction ? q.direction === "import" : (q.mode === "air" ? NZ_AIRPORTS.has(dest) : dest.startsWith("NZ"));
  const key = q.mode === "air" ? (imp ? "IA" : "EA") : (imp ? "IS" : "ES");
  return INBOX[key];
}

const titleCase = (s?: string | null) => (s ? s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()) : null);
const money = (cur: string | null, n: unknown) =>
  n == null ? null : `${cur ?? "NZD"} ${Number(n).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function quoteDecisionAlert(q: Payload): { to: string; replyTo?: string; subject: string; email: NotifyEmail } {
  const box = inboxOf(q);
  const who = titleCase(q.customer_name) ?? q.account_id ?? "Customer";
  const ok = q.status === "approved";
  const person = q.decided_by_name || q.decided_by_email || who;
  const ref = ok ? `${q.quote_no} (${q.response_no ?? "option"})` : q.quote_no;
  const to = [Deno.env.get("PORTAL_BOOKING_ALERT_TO") || box.email, q.staff_email].filter(Boolean).join(",");
  return {
    to,
    replyTo: q.decided_by_email ?? undefined,
    subject: `Quote ${ref} ${ok ? "APPROVED" : "rejected"}: ${who}, ${q.origin} to ${q.destination}`,
    email: {
      preheader: `${person} ${ok ? "approved" : "rejected"} ${ref} on the portal.`,
      eyebrow: `${box.team} · Portal quote ${ok ? "approved" : "rejected"}`,
      title: `${who} ${ok ? "approved" : "rejected"} ${ref}`,
      intro: ok
        ? [`${person} approved this quote on the customer portal. The quote is now marked Won${Number(q.options) > 1 ? " and the other options are cross win" : ""}.`, "Set up the booking and confirm space with the customer."]
        : [`${person} rejected ${Number(q.options) > 1 ? `all ${q.options} options on` : ""} this quote on the customer portal.`.replace("  ", " "), "Review the reason, then re-price and send a new response if it makes sense."],
      callout: q.note ? { tone: ok ? "green" : "red", text: `Customer note: ${q.note}` } : null,
      facts: [
        ["Customer", `${who}${q.account_id ? ` (${q.account_id})` : ""}`],
        ["Quote", q.quote_no],
        ["Chosen option", ok ? q.response_no : null],
        ["Route", `${q.origin} to ${q.destination}`],
        ["Carrier", ok || Number(q.options) <= 1 ? q.carrier : null],
        ["Total", ok || Number(q.options) <= 1 ? money(q.currency, q.total_sell) : null],
        ["Customer ref", q.customer_ref],
      ],
      button: { label: "Open quote", url: `${CONSOLE_URL}/quotes/${q.id}` },
      footer: "Sent when a customer answers a quote on portal.ubfreight.com. Reply to reach the customer.",
    },
  };
}
