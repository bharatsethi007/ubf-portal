// src/features/sli/dgHints.ts
// Reads the goods description and flags words that usually mean dangerous goods by air.
// A hint, not a classification: the supplier still answers the DG question.

export type DgHint = { word: string; kind: string; battery?: "lithium_ion" | "lithium_metal" | "lead_acid" };

const RULES: { re: RegExp; kind: string; battery?: DgHint["battery"] }[] = [
  { re: /\b(lithium|li-?ion|li-?po|lipo|power ?banks?|e-?bikes?|e-?scooters?|hoverboards?|laptops?|notebooks? computer|mobile phones?|smart ?phones?|tablets?|drones?|cordless|rechargeable)\b/i, kind: "Lithium batteries", battery: "lithium_ion" },
  { re: /\b(coin cells?|button cells?|lithium metal)\b/i, kind: "Lithium metal batteries", battery: "lithium_metal" },
  { re: /\b(lead[- ]acid|car batter(y|ies)|wet cell|agm batter(y|ies))\b/i, kind: "Wet / lead acid batteries", battery: "lead_acid" },
  { re: /\bbatter(y|ies)\b/i, kind: "Batteries" },
  { re: /\b(aerosols?|spray ?cans?|spray paint)\b/i, kind: "Aerosols" },
  { re: /\b(paints?|lacquers?|varnish(es)?|thinners?|solvents?|adhesives?|glues?|resins?|epoxy|sealants?|inks?)\b/i, kind: "Flammable liquids" },
  { re: /\b(perfumes?|fragrances?|colognes?|nail polish|hand sanitiser|hand sanitizer|ethanol|methanol|isopropyl|spirits?|vodka|whisk(e)?y|rum|gin|liqueur)\b/i, kind: "Flammable liquids" },
  { re: /\b(fuel|petrol|diesel|kerosene|lighters?|matches|butane|propane|lpg|gas cylinders?|gas bottles?)\b/i, kind: "Fuel or flammable gas" },
  { re: /\b(oxygen|compressed|co2|nitrogen|helium|fire extinguishers?|scuba)\b/i, kind: "Compressed gas" },
  { re: /\b(dry ice|carbon dioxide solid)\b/i, kind: "Dry ice" },
  { re: /\b(magnets?|magnetised|magnetized|loudspeakers?|speakers?)\b/i, kind: "Magnetised material" },
  { re: /\b(acids?|bleach|corrosives?|caustic|chlorine|pool chemicals?|chemicals?|pesticides?|herbicides?|insecticides?|fertili[sz]ers?|peroxide)\b/i, kind: "Chemicals" },
  { re: /\b(engines?|generators?|lawn ?mowers?|chainsaws?|outboards?|motorbikes?|motorcycles?|leaf blowers?|water blasters?)\b/i, kind: "Engines or fuel-powered equipment" },
  { re: /\b(fireworks?|ammunition|ammo|flares?|explosives?|detonators?|cartridges?)\b/i, kind: "Explosives" },
  { re: /\b(mercury|thermometers?|barometers?)\b/i, kind: "Mercury" },
  { re: /\b(radioactive|isotopes?)\b/i, kind: "Radioactive material" },
];

/** First matching rule per kind, so "lithium battery" gives one hint, not two. */
export function dgHints(text: string | null | undefined): DgHint[] {
  const t = String(text ?? "");
  if (t.trim().length < 3) return [];
  const out: DgHint[] = [];
  const kinds = new Set<string>();
  for (const r of RULES) {
    const m = t.match(r.re);
    if (!m) continue;
    // Plain "battery" adds nothing once a specific battery type matched.
    if (r.kind === "Batteries" && out.some((h) => h.battery)) continue;
    if (kinds.has(r.kind)) continue;
    kinds.add(r.kind);
    out.push({ word: m[0], kind: r.kind, battery: r.battery });
  }
  return out;
}
