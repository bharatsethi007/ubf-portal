import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const IATA_RE = /^[A-Z]{3}$/;

type AirPort = { code: string; name: string };

async function findAirPorts(db: SupabaseClient, term: string): Promise<AirPort[]> {
  const t = term.trim();
  if (!t) return [];
  const upper = t.toUpperCase();
  const { data, error } = await db
    .from("ports")
    .select("code, name")
    .eq("kind", "air")
    .or(`code.eq.${upper},name.ilike.%${t}%`)
    .limit(12);
  if (error) throw new Error(`port lookup failed: ${error.message}`);
  return (data ?? []) as AirPort[];
}

/** Prefer a 3-letter IATA match; avoid guessing when ambiguous. */
function pickBest(term: string, matches: AirPort[]): string | null {
  if (!matches.length) return null;
  const q = term.trim().toLowerCase();
  const upper = term.trim().toUpperCase();

  if (IATA_RE.test(upper)) {
    const exact = matches.find((m) => m.code.toUpperCase() === upper);
    return exact?.code ?? null;
  }

  const iata = matches.filter((m) => m.code.length === 3);
  if (!iata.length) return null;

  const ranked = iata
    .map((m) => {
      const name = m.name.toLowerCase();
      let score = 2;
      if (name.includes(q)) score = name.startsWith(q) ? 0 : 1;
      return { code: m.code, score };
    })
    .sort((a, b) => a.score - b.score);

  if (ranked.length === 1 || ranked[0].score < ranked[1]?.score) {
    return ranked[0].code;
  }
  return null;
}

export async function resolvePortCode(
  db: SupabaseClient,
  raw: string | null | undefined,
): Promise<{ code: string | null; unresolved: boolean }> {
  const term = (raw ?? "").trim();
  if (!term) return { code: null, unresolved: false };
  if (IATA_RE.test(term.toUpperCase())) {
    const matches = await findAirPorts(db, term);
    const code = pickBest(term, matches);
    return { code, unresolved: !code };
  }
  const matches = await findAirPorts(db, term);
  const code = pickBest(term, matches);
  return { code, unresolved: !code };
}

export async function resolveBookingPorts(
  db: SupabaseClient,
  origin: string | null | undefined,
  destination: string | null | undefined,
): Promise<{ origin: string | null; destination: string | null; unresolved: string[] }> {
  const [o, d] = await Promise.all([
    resolvePortCode(db, origin),
    resolvePortCode(db, destination),
  ]);
  const unresolved: string[] = [];
  if (origin?.trim() && o.unresolved) unresolved.push("origin");
  if (destination?.trim() && d.unresolved) unresolved.push("destination");
  return { origin: o.code, destination: d.code, unresolved };
}
