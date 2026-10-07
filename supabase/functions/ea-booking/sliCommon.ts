// UBF Air SLI: turns the raw blocks read from a .docx or .pdf SLI into booking form fields. No AI.
import type { EaForm, Line, Party } from "./extract.ts";

/** What both readers (Word + PDF) pull out of the SLI, before any interpretation. */
export type RawSli = {
  shipper: string[]; consignee: string[]; notify: string[];
  terms: string; dest: string; declared: string; origin: string;
  cargo: { pcs: string; l: string; w: string; h: string; kg: string }[]; desc: string[];
  pickupText: string; pickupTicked: boolean; deliverTicked: boolean; dgYes: boolean; insuranceYes: boolean;
};

export type SliResult = Partial<EaForm> & { _sli_filled: string[] };

const AIRPORTS: [RegExp, string][] = [
  [/\b(NAN|NADI|LAUTOKA)\b/i, "NAN"], [/\b(SUV|SUVA|NAUSORI|NASINU|WALU BAY)\b/i, "SUV"], [/\b(LBS|LABASA|LAUCALA|VANUA LEVU)\b/i, "LBS"],
  [/\b(TBU|TONGA|NUKU'?ALOFA)\b/i, "TBU"], [/\b(APW|APIA|SAMOA)\b/i, "APW"], [/\b(HIR|HONIARA|SOLOMON)/i, "HIR"],
  [/\b(VLI|PORT VILA|VANUATU)\b/i, "VLI"], [/\b(RAR|RAROTONGA|COOK ISLANDS)\b/i, "RAR"], [/\b(NOU|NOUMEA|NEW CALEDONIA)\b/i, "NOU"],
  [/\b(POM|PORT MORESBY|PAPUA)\b/i, "POM"], [/\b(PPT|TAHITI|PAPEETE)\b/i, "PPT"], [/\b(FUN|TUVALU|FUNAFUTI)\b/i, "FUN"],
  [/\b(TRW|KIRIBATI|TARAWA)\b/i, "TRW"], [/\b(IUE|NIUE)\b/i, "IUE"],
];
const COUNTRIES: [RegExp, string][] = [
  [/^new zealan?d?$|^nz$/i, "NZ"], [/^fiji( islands)?$/i, "FJ"], [/^(kingdom of )?tonga$/i, "TO"], [/^samoa$/i, "WS"],
  [/^solomon islands$/i, "SB"], [/^vanuatu$/i, "VU"], [/^cook islands$/i, "CK"], [/^australia$/i, "AU"], [/^new caledonia$/i, "NC"],
];
const CITIES = /\b(Auckland|Wellington|Christchurch|Hamilton|Tauranga|Napier|Hastings|Dunedin|Palmerston North|Nelson|Rotorua|Whangarei|Suva|Nadi|Lautoka|Labasa|Nausori|Nasinu|Nuku'?alofa|Apia|Honiara|Port Vila|Rarotonga|Noumea)\b/i;
const NUMWORD: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const BOILER = /does your shipment contain|consumer batteries|lithium battery|lead acid batteries|^\(?inco terms/i;

const tidy = (s: string) => s.replace(/\s+/g, " ").replace(/^[\s,;:/-]+|[\s,;:/-]+$/g, "").trim();
const num = (s: string) => { const m = s.replace(/,/g, "").match(/\d*\.?\d+/); return m ? +m[0] : null; };

export function parseParty(lines: string[]): Party {
  const p: Party = {};
  const rest: string[] = [];
  for (let raw of lines.map(tidy).filter(Boolean)) {
    if (/^(ship to|attn|attention)\s*:?\s*$/i.test(raw)) continue;
    const email = raw.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/);
    if (email) { p.email ??= email[0].toLowerCase(); raw = tidy(raw.replace(email[0], "").replace(/<|>/g, "")); }
    const ph = raw.match(/(?:ph(?:one)?|tel|mob(?:ile)?|m)?\s*[:.]?\s*(\+?\(?\d[\d ()+-]{5,}\d)/i);
    if (ph && (/ph|tel|mob/i.test(raw) || ph[1].replace(/\D/g, "").length >= 7 && !/\b(road|rd|street|st|ave|place|drive|unit|level)\b/i.test(raw))) {
      p.phone ??= ph[1].trim(); raw = tidy(raw.replace(ph[0], ""));
      // "Allan Seu 027..." : a short name left beside a phone number is the contact.
      if (raw && !/\d/.test(raw) && raw.split(" ").length <= 4 && !CITIES.test(raw)) { p.contact ??= raw; continue; }
    }
    const attn = raw.match(/^(?:attn|attention)\s*:?\s*(.+)/i);
    if (attn) { p.contact ??= tidy(attn[1]); continue; }
    if (!raw) continue;
    const c = COUNTRIES.find(([re]) => re.test(raw));
    if (c) { p.country ??= c[1]; continue; }
    rest.push(raw);
  }
  // A first line starting with a number is an address, not a company name.
  if (rest.length && !/^\d/.test(rest[0])) p.name = rest.shift()!.replace(/,$/, "");
  if (rest.length) {
    p.address = rest.join(", ").replace(/,\s*,/g, ",");
    const city = [...rest].reverse().map((l) => l.match(CITIES)?.[1]).find(Boolean);
    if (city) p.city = city.toLowerCase().replace(/(^|[\s'-])\w/g, (m) => m.toUpperCase()).replace("'A", "'a");
    const pc = p.address.match(/\b(\d{4})\b(?!.*\b\d{4}\b)/);
    if (pc && (!p.country || p.country === "NZ")) p.postcode = pc[1];
  }
  return p;
}

function pieces(s: string): number | null {
  const t = s.trim();
  const lead = t.match(/^(\d+)/);
  if (lead) return +lead[1];
  const w = t.toLowerCase().match(/^(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  if (w) return NUMWORD[w[1]];
  if (/(pallet|plt|carton|ctn|box|crate|pkg|case|skid)\s*\d+/i.test(t)) return 1;
  return null;
}

function dim(v: number | null, big: boolean) {
  if (v == null || v <= 0) return null;
  if (big) return +(v / 10).toFixed(1); // mm
  if (v < 3) return +(v * 100).toFixed(1); // metres
  return v;
}

export function cargoLines(rows: RawSli["cargo"]): Line[] {
  const out: Line[] = [];
  for (const r of rows) {
    const p = pieces(r.pcs);
    const [l, w, h, kg] = [num(r.l), num(r.w), num(r.h), num(r.kg)];
    if (p == null && kg == null && l == null) continue;
    out.push({ pieces: p ?? (l || kg ? 1 : null), l, w, h, kg });
  }
  const big = out.some((x) => (x.l ?? 0) > 400 || (x.w ?? 0) > 400 || (x.h ?? 0) > 400);
  return out.map((x) => ({ ...x, l: dim(x.l ?? null, big), w: dim(x.w ?? null, big), h: dim(x.h ?? null, big) }));
}

function ready(text: string) {
  const d = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  const t = text.match(/\b(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
  let date: string | null = null;
  if (d) { const y = d[3].length === 2 ? `20${d[3]}` : d[3]; date = `${y}-${d[2].padStart(2, "0")}-${d[1].padStart(2, "0")}`; }
  let time: string | null = null;
  if (t && !(d && t.index === d.index)) {
    let h = +t[1]; if (t[3]?.toLowerCase() === "pm" && h < 12) h += 12; if (t[3]?.toLowerCase() === "am" && h === 12) h = 0;
    if (h < 24 && +t[2] < 60) time = `${String(h).padStart(2, "0")}:${t[2]}`;
  }
  return { date: date && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date) ? date : null, time };
}

export function toForm(raw: RawSli, fileName: string): SliResult | null {
  const shipper = parseParty(raw.shipper);
  const consignee = parseParty(raw.consignee);
  const lines = cargoLines(raw.cargo);
  if (!shipper.name && !consignee.name && !lines.length) return null; // blank template
  const filled: string[] = [];
  const r: SliResult = { _sli_filled: filled };
  if (Object.keys(shipper).length) { r.shipper = { country: "NZ", ...shipper }; filled.push("shipper"); }
  if (Object.keys(consignee).length) { r.consignee = consignee; filled.push("consignee"); }
  if (lines.length) { r.lines = lines; filled.push("cargo"); }
  const dest = AIRPORTS.find(([re]) => re.test(raw.dest))?.[1] ?? AIRPORTS.find(([re]) => re.test(raw.consignee.join(" ")))?.[1];
  if (dest) { r.destination = dest; filled.push("destination"); }
  const inco = raw.terms.split(/\n|\//).filter((l) => !BOILER.test(l.trim())).join(" ")
    .match(/\b(EXW|FCA|FOB|CFR|CIF|CPT|CIP|DAT|DAP|DPU|DDP)\b/i)?.[1];
  if (inco) { r.incoterm = inco.toUpperCase(); filled.push("incoterm"); }
  const desc = raw.desc.map(tidy).filter((d) => d && !BOILER.test(d));
  if (desc.length) { r.goods = desc.join("; ").slice(0, 300); filled.push("goods"); }
  if (raw.dgYes) { r.is_dg = true; filled.push("dangerous goods"); }
  const pickText = tidy(raw.pickupText.replace(/\(?\s*time\s*\/\s*date\s*\)?/i, ""));
  if (raw.pickupTicked || pickText) {
    const when = ready(pickText);
    r.pickup = { needed: true, address: null, contact: null, phone: null, ready_time: when.time };
    if (when.date) r.ready_date = when.date;
    filled.push("pickup");
  } else if (raw.deliverTicked) {
    r.pickup = { needed: false, address: null, contact: null, phone: null, ready_time: null };
    filled.push("drop-off");
  }
  const notes = [
    `SLI: ${fileName}`,
    tidy(raw.declared) && `Declared value: ${tidy(raw.declared)}`,
    tidy(raw.origin) && `Origin: ${tidy(raw.origin)}`,
    raw.insuranceYes && "Insurance requested",
    raw.notify.map(tidy).filter(Boolean).length && `Notify / special: ${raw.notify.map(tidy).filter(Boolean).join(", ")}`,
    pickText && `Pickup: ${pickText}`,
  ].filter(Boolean);
  r.notes = notes.join("\n");
  return r;
}
