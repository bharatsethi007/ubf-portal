import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("fleet-reminders-digest");

const FIELD_LABEL: Record<string, string> = {
  rego_expiry: "Rego expiry", cof_expiry: "COF expiry", last_service: "Last service",
  next_service: "Next service", general: "General",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
function esc(s: string) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string)); }
function nzParts(d: Date) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(d).map((p) => [p.type, p.value]));
}
function buildHtml(nzDate: string, rems: { rego: string; field: string; due: string | null; note: string | null }[], missing: string[]) {
  const remRows = rems.length
    ? rems.map((r) => `<li><b>${esc(r.rego)}</b> \u2014 ${esc(FIELD_LABEL[r.field] ?? r.field)}${r.due ? ` (due ${esc(r.due)})` : ""}${r.note ? `: ${esc(r.note)}` : ""}</li>`).join("")
    : "<li>None</li>";
  const missRows = missing.length ? missing.map((m) => `<li>${esc(m)}</li>`).join("") : "<li>None</li>";
  return `<div style="font-family:system-ui,Arial,sans-serif;color:#111">`
    + `<h2 style="color:#0A2472;margin:0 0 4px">UBF fleet reminders</h2>`
    + `<p style="color:#666;margin:0 0 16px">${esc(nzDate)}</p>`
    + `<h3 style="color:#0A2472;margin:0 0 6px">Vehicle reminders due</h3><ul>${remRows}</ul>`
    + `<h3 style="color:#0A2472;margin:16px 0 6px">Signed on without a completed daily check</h3><ul>${missRows}</ul>`
    + `</div>`;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const now = new Date();
    const p = nzParts(now);
    const nzDate = `${p.year}-${p.month}-${p.day}`;
    const nzHour = parseInt(p.hour as string, 10);

    if (!force && nzHour !== 7) return json({ skipped: `NZ hour ${nzHour}, not 7`, nzDate });

    if (!force) {
      const { data: existing } = await supabase.from("tms_digest_log").select("nz_date").eq("nz_date", nzDate).maybeSingle();
      if (existing) return json({ skipped: "already sent today", nzDate });
    }

    const { data: reminders } = await supabase.from("tms_vehicle_reminders")
      .select("id,field,due_date,note,vehicle:tms_vehicles!tms_vehicle_reminders_vehicle_id_fkey(registration_number)")
      .eq("done", false)
      .or(`due_date.is.null,due_date.lte.${nzDate}`);
    const remList = (reminders ?? []).map((r: any) => ({
      rego: r.vehicle?.registration_number ?? "\u2014", field: r.field, due: r.due_date ?? null, note: r.note ?? null,
    }));

    const sinceIso = new Date(now.getTime() - 36 * 3600 * 1000).toISOString();
    const { data: logons } = await supabase.from("tms_driver_vehicle")
      .select("driver_id,logged_on_at,driver:tms_drivers!tms_driver_vehicle_driver_id_fkey(first_name,last_name)")
      .gte("logged_on_at", sinceIso);
    const nzDateOf = (iso: string) => { const q = nzParts(new Date(iso)); return `${q.year}-${q.month}-${q.day}`; };
    const todayLogons = (logons ?? []).filter((l: any) => l.logged_on_at && nzDateOf(l.logged_on_at) === nzDate);
    const { data: checks } = await supabase.from("tms_daily_checks").select("driver_id").eq("check_date", nzDate).eq("status", "completed");
    const checkedIds = new Set((checks ?? []).map((c: any) => c.driver_id));
    const missingMap = new Map<string, string>();
    for (const l of todayLogons) {
      if (!checkedIds.has(l.driver_id) && !missingMap.has(l.driver_id)) {
        const d = l.driver; missingMap.set(l.driver_id, d ? `${d.first_name} ${d.last_name}` : "Driver");
      }
    }
    const missing = [...missingMap.values()];

    const nothing = remList.length === 0 && missing.length === 0;
    const { data: recips } = await supabase.from("tms_notification_recipients").select("email").eq("active", true);
    const to = (recips ?? []).map((r: any) => ({ email: r.email }));

    let sent = false;
    if (!nothing && to.length) {
      const key = Deno.env.get("BREVO_API_KEY");
      const from = Deno.env.get("SLI_FROM_EMAIL") ?? "no-reply@ubfreight.com";
      if (key) {
        const resp = await apiFetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            sender: { email: from, name: "UB Freight Fleet" }, to,
            subject: `UBF fleet reminders \u2013 ${nzDate}`, htmlContent: buildHtml(nzDate, remList, missing),
          }),
        });
        sent = resp.ok;
        if (!resp.ok) console.error("brevo", resp.status, await resp.text());
      }
    }

    if (!force) await supabase.from("tms_digest_log").upsert({ nz_date: nzDate }, { onConflict: "nz_date" });

    return json({ nzDate, reminders: remList.length, missingChecks: missing.length, recipients: to.length, sent });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
