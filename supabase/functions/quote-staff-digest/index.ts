// quote-staff-digest — CRON (service key). Monday 8am NZ: each quote owner gets their open quotes priced 7+ days ago.
// Sent through Outlook (MS Graph) as the sales support mailbox. ?force=1 skips the time check. verify_jwt=false (own auth).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { setApiFn } from "../_shared/apiFetch.ts";
import { isServiceCaller } from "../_shared/serviceAuth.ts";
import { graphToken } from "../email-inbox-sync/graph.ts";
import { sendAsMailbox } from "../booking-email-send/graphSend.ts";
import { renderStaffDigest, type DigestRow } from "../_shared/quoteEmail.ts";
setApiFn("quote-staff-digest");

const MAILBOX = Deno.env.get("QUOTE_REMINDER_MAILBOX") ?? "salessupport.nz@ubfreight.com";
const CONSOLE = (Deno.env.get("CONSOLE_URL") ?? "https://console.ubfreight.com").replace(/\/+$/, "");
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

function nzNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", weekday: "short", hour: "2-digit", hour12: false })
    .formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { weekday: parts.weekday as string, hour: Number(parts.hour) };
}

Deno.serve(async (req) => {
  try {
    if (!(await isServiceCaller(req))) return json({ error: "unauthorized" }, 401);
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    const only = url.searchParams.get("user"); // optional: test for one staff user_id
    const toOverride = url.searchParams.get("to"); // optional: test, send everything to this address
    const now = nzNow();
    if (!force && !(now.weekday === "Mon" && now.hour === 8)) return json({ skipped: true, nz: now });

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Priced 7+ days ago = expires_at at most 23 days from now (30-day window).
    const cutoff = new Date(Date.now() + 23 * 86400000).toISOString();
    let qq = db.from("quotes")
      .select("id, quote_no, customer_name, from_port_code, to_port_code, expires_at, last_reminded_at, created_by")
      .in("status", ["open", "published", "sent"]).not("expires_at", "is", null).lte("expires_at", cutoff)
      .not("created_by", "is", null).order("expires_at");
    if (only) qq = qq.eq("created_by", only);
    const { data: quotes, error } = await qq;
    if (error) throw error;
    if (!quotes?.length) return json({ ok: true, sent: 0 });

    const owners = [...new Set(quotes.map((q) => q.created_by as string))];
    const { data: staff } = await db.from("staff_users").select("user_id, full_name, email, is_active").in("user_id", owners);
    const codes = [...new Set(quotes.flatMap((q) => [q.from_port_code, q.to_port_code]).filter(Boolean))] as string[];
    const { data: ports } = await db.from("ports").select("code, name").in("code", codes);
    const pn = (c: string | null) => (c ? ports?.find((p) => p.code === c)?.name ?? c : "?");

    const token = await graphToken();
    const out: { to: string; n: number; ok: boolean; error?: string }[] = [];
    for (const s of staff ?? []) {
      if (!s.email || s.is_active === false) continue;
      const mine = quotes.filter((q) => q.created_by === s.user_id);
      if (!mine.length) continue;
      const rows: DigestRow[] = mine.map((q) => ({
        quoteNo: q.quote_no ?? "", customer: q.customer_name ?? "", lane: `${pn(q.from_port_code)} to ${pn(q.to_port_code)}`,
        agedDays: Math.max(7, Math.round((Date.now() - (new Date(q.expires_at!).getTime() - 30 * 86400000)) / 86400000)),
        expiresAt: q.expires_at, lastReminded: q.last_reminded_at,
        url: `${CONSOLE}/quotes/${q.id}`,
      }));
      const mail = renderStaffDigest(s.full_name, rows, CONSOLE);
      try {
        const dest = toOverride ?? s.email;
        await sendAsMailbox(token, MAILBOX, { subject: (toOverride ? "[TEST] " : "") + mail.subject, html: mail.html, to: [dest], cc: [], attachments: [] });
        out.push({ to: dest, n: rows.length, ok: true });
      } catch (e) {
        out.push({ to: s.email, n: rows.length, ok: false, error: String(e).slice(0, 200) });
      }
    }
    return json({ ok: true, sent: out.filter((o) => o.ok).length, out });
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
