// Server-side clean-up of the model output: expand compact lines, validate every port code against the
// full ports table (17k+ UN/LOCODE rows), fall back to aliases and name matches, and normalise numbers.
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"

export type OutLine = {
  origin_port_code: string; raw_origin: string; dest_port_code: string; raw_dest: string
  container_type: string; raw_container: string; base_rate: number | null; sell_rate: number | null
  currency_code: string; transit_days: number | null; via: string; carrier: string
  valid_from: string | null; valid_to: string | null; confidence: "green" | "amber" | "red"; note: string
}

const num = (v: any): number | null => {
  if (v == null || v === "") return null
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""))
  return Number.isFinite(n) && n !== 0 ? n : null
}
const up = (v: any) => String(v ?? "").trim().toUpperCase()
const worst = (a: string, b: string) => (a === "red" || b === "red" ? "red" : a === "amber" || b === "amber" ? "amber" : "green") as OutLine["confidence"]

/** Strip province / terminal noise: "Nan sha, Guangdong" -> "nan sha", "Huang pu (Xinsha)" -> "huang pu". */
function cleanName(raw: string): string {
  return raw.replace(/[（(].*?[)）]/g, " ").split(/[,/]/)[0].replace(/\b(new|old)?\s*port\b/gi, " ").replace(/\s+/g, " ").trim().toLowerCase()
}

export async function resolveAll(db: SupabaseClient, raw: any) {
  const lines: any[] = Array.isArray(raw?.lines) ? raw.lines : []
  const surcharges: any[] = Array.isArray(raw?.surcharges) ? raw.surcharges : []
  const local: any[] = Array.isArray(raw?.local) ? raw.local : []

  const codes = new Set<string>()
  for (const l of lines) { codes.add(up(l.o)); for (const d of l.d ?? []) codes.add(up(d)) }
  for (const s of surcharges) if (s.o) codes.add(up(s.o))
  for (const p of local) if (p.port) codes.add(up(p.port))
  codes.delete("")
  const { data: known } = await db.from("ports").select("code").in("code", [...codes])
  const valid = new Set((known ?? []).map((r: any) => r.code as string))

  // Names the model could not code (or coded wrongly): alias table, then exact cleaned-name match.
  const needs = [...new Set(lines.filter((l) => !valid.has(up(l.o)) && l.ro).map((l) => String(l.ro).trim()))]
  const byRaw = new Map<string, { code: string; how: "alias" | "name" }>()
  if (needs.length) {
    const { data: al } = await db.from("port_aliases").select("alias, port_code")
    const aliasMap = new Map((al ?? []).map((a: any) => [String(a.alias).toLowerCase().trim(), a.port_code as string]))
    const names = new Set<string>()
    for (const r of needs) {
      const hit = aliasMap.get(r.toLowerCase())
      if (hit) byRaw.set(r, { code: hit, how: "alias" }); else names.add(cleanName(r))
    }
    if (names.size) {
      // Port names in UN/LOCODE vary in spacing and a trailing "Pt": try each spelling, compare on a squashed key.
      const title = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase())
      const variants = new Set<string>()
      for (const n of names) {
        if (!n) continue
        const squashed = n.replace(/\s+/g, "")
        for (const v of [title(n), title(squashed), `${title(n)} Pt`, `${title(squashed)} Pt`]) variants.add(v)
      }
      const key = (s: string) => s.toLowerCase().replace(/\s+pt$/, "").replace(/\s+/g, "")
      const { data: pn } = await db.from("ports").select("code, name, is_core").eq("kind", "sea").in("name", [...variants])
      const nameMap = new Map<string, string>()
      for (const p of (pn ?? []) as any[]) {
        const k = key(String(p.name))
        if (!nameMap.has(k) || p.is_core) nameMap.set(k, p.code)
      }
      for (const r of needs) {
        if (byRaw.has(r)) continue
        const c = nameMap.get(key(cleanName(r)))
        if (c) byRaw.set(r, { code: c, how: "name" })
      }
    }
  }

  const out: OutLine[] = []
  for (const l of lines) {
    let o = up(l.o); let cf = (["green", "amber", "red"].includes(l.cf) ? l.cf : "green") as OutLine["confidence"]
    let note = String(l.n ?? "")
    if (!valid.has(o)) {
      const fix = byRaw.get(String(l.ro ?? "").trim())
      if (fix) { o = fix.code; cf = worst(cf, fix.how === "alias" ? "green" : "amber") }
      else { o = ""; cf = "red"; note = note || "Origin port not found" }
    }
    const tt = l.tt && typeof l.tt === "object" ? l.tt : {}
    const dests = (Array.isArray(l.d) ? l.d : [l.d]).map(up).filter(Boolean)
    for (const d of dests.length ? dests : [""]) {
      const dOk = valid.has(d)
      out.push({
        origin_port_code: o, raw_origin: String(l.ro ?? ""), dest_port_code: dOk ? d : "", raw_dest: String(l.rd ?? ""),
        container_type: up(l.c), raw_container: String(l.rc ?? ""), base_rate: num(l.b), sell_rate: num(l.s),
        currency_code: up(l.cur), transit_days: num(tt[d]) ?? null, via: String(l.via ?? ""), carrier: up(l.car),
        valid_from: l.vf || null, valid_to: l.vt || null,
        confidence: dOk ? cf : "red", note: dOk ? note : note || "Destination port not found",
      })
    }
  }
  const sur = surcharges
    .map((s) => ({ charge_code: String(s.code ?? ""), label: String(s.label ?? s.code ?? ""), amount: num(s.a), currency_code: up(s.cur),
      basis: String(s.basis || "per_container"), container_type: s.c ? up(s.c) : null, scope: ["origin", "freight", "dest"].includes(s.scope) ? s.scope : "freight",
      origin_port_code: s.o && valid.has(up(s.o)) ? up(s.o) : null, carrier: s.car ? up(s.car) : null, condition: String(s.cond ?? "") }))
    .filter((s) => s.amount != null && s.label)
  const loc = local
    .map((p) => ({ port_code: up(p.port), direction: p.dir === "origin" ? "origin" : "dest", carrier: up(p.car), charge_code: String(p.code ?? ""),
      label: String(p.label ?? ""), basis: ["per_container", "per_bl", "per_shipment"].includes(p.basis) ? p.basis : "per_container",
      size: ["20", "40"].includes(String(p.size)) ? String(p.size) : "all", amount: num(p.a), currency_code: up(p.cur) }))
    .filter((p) => p.amount != null && p.label && valid.has(p.port_code))
  return { lines: out, surcharges: sur, local_charges: loc }
}
