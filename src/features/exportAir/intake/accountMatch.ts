// Match an email party to a TradeWindow customer account (customers table, synced from the ERP). No AI, runs in the browser.
// Order: what staff picked before for this email address, then email domain, then fuzzy company name.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/supabase'

export type Account = {
  account_id: string; name: string; address1: string | null; address2: string | null; address3: string | null
  city: string | null; postcode: string | null; country: string | null; phone: string | null; email: string | null; contact: string | null
  score: number; via: "history" | "domain" | "name"
};

const COLS = "account_id,name,address1,address2,address3,city,postcode,country,phone,email,contact,closed";
const GENERIC = /@(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|msn|xtra|ubfreight|aol|proton|protonmail)\./i;
const STOP = new Set(["ltd", "limited", "pte", "pty", "co", "company", "inc", "llc", "the", "and", "nz", "new", "zealand", "fiji", "group", "trading", "international", "services", "of"]);

export const normName = (s: string) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w)).join(" ");

function dice(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) ?? 0) + 1); } return m; };
  const A = grams(a), B = grams(b);
  let hit = 0;
  for (const [g, n] of A) hit += Math.min(n, B.get(g) ?? 0);
  return (2 * hit) / (Math.max(1, a.length - 1) + Math.max(1, b.length - 1));
}

const toAcc = (r: any, score: number, via: Account["via"]): Account => ({ ...r, score: +score.toFixed(2), via });

export async function matchAccount(
  role: "shipper" | "consignee", p: { name?: string | null; email?: string | null; country?: string | null },
): Promise<Account | null> {
  const email = (p.email ?? "").trim().toLowerCase();

  // 1. Learned: last EA booking from this address where staff set the account.
  if (email) {
    const col = role === "shipper" ? "shipper" : "consignee";
    const { data } = await supabase.from("bookings").select(`${col}_account_id`).eq("module", "EA")
      .ilike(`${col}_email`, email).not(`${col}_account_id`, "is", null).order("created_at", { ascending: false }).limit(1);
    const id = (data?.[0] as Record<string, string | null> | undefined)?.[`${col}_account_id`];
    if (id) {
      const { data: c } = await supabase.from("customers").select(COLS).eq("account_id", id).maybeSingle();
      if (c) return toAcc(c, 1, "history");
    }
  }

  // 2. Email domain on the account or one of its contacts.
  const domain = email.includes("@") && !GENERIC.test(email) ? email.split("@")[1] : "";
  if (domain) {
    const [{ data: cs }, { data: ct }] = await Promise.all([
      supabase.from("customers").select(COLS).ilike("email", `%@${domain}`).eq("closed", false).limit(5),
      supabase.from("contacts").select("account_id").ilike("email", `%@${domain}`).limit(5),
    ]);
    const ids = new Set<string>([...(cs ?? []).map((c: any) => c.account_id), ...(ct ?? []).map((c: any) => c.account_id)]);
    if (ids.size === 1) {
      const id = [...ids][0];
      const row = (cs ?? []).find((c: any) => c.account_id === id)
        ?? (await supabase.from("customers").select(COLS).eq("account_id", id).maybeSingle()).data;
      if (row) return toAcc(row, 0.95, "domain");
    }
  }

  // 3. Fuzzy company name (from the form, else the email domain root, e.g. ampac.net -> ampac).
  const raw = (p.name ?? "").trim() || (domain ? domain.split(".")[0].replace(/(fj|fiji|nz|au|to|ws)$/i, "") : "");
  const target = normName(raw);
  if (target.length < 3) return null;
  const token = target.split(" ").sort((a, b) => b.length - a.length)[0];
  if (!token || token.length < 3) return null;
  const { data: cands } = await supabase.from("customers").select(COLS).ilike("name", `%${token}%`).eq("closed", false).limit(40);
  const want = (p.country ?? (role === "shipper" ? "NZ" : "")).toUpperCase();
  const scored = ((cands ?? []) as any[]).map((c) => {
    let s = dice(target, normName(c.name ?? ""));
    if (want && (c.country ?? "").toUpperCase() === want) s += 0.08;
    return { c, s };
  }).sort((a, b) => b.s - a.s);
  const best = scored[0];
  if (!best || best.s < 0.6) return null;
  if (scored[1] && best.s - scored[1].s < 0.04) return null; // too close to call, let staff pick
  return toAcc(best.c, Math.min(best.s, 0.99), "name");
}
