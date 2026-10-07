// Reads the UBF Air SLI Word template (.docx): one table, fields found by their printed labels.
import { strFromU8, unzipSync } from "npm:fflate@0.8.2";
import type { RawSli } from "./sliCommon.ts";

type Cell = { r: number; c: number; span: number; lines: string[] };
const ON = "☒", OFF = "☐";
// Wingdings / Symbol glyphs Word uses for tick boxes.
const SYM_ON = new Set(["F0FE", "F078", "F0FD", "F0FC", "F0FB", "F0FF", "F0D6", "2612"]);
const SYM_OFF = new Set(["F06F", "F0A8", "F071", "F072", "F0A1", "2610"]);
const dec = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

function para(xml: string): string {
  let out = "";
  const re = /<w:checked(?: w:val="(\w+)")?\/>|<w:sym [^>]*w:char="(\w+)"|<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[0].startsWith("<w:checked")) { if (m[1] == null || m[1] === "1" || m[1] === "true") out += ON; }
    else if (m[2]) out += SYM_ON.has(m[2].toUpperCase()) ? ON : SYM_OFF.has(m[2].toUpperCase()) ? OFF : "";
    else if (m[3] != null) out += dec(m[3]);
    else out += m[0] === "<w:br/>" ? "\n" : " ";
  }
  // A typed X right before an empty box means ticked.
  return out.replace(/\b[xX]\s*☐/g, ON).replace(/[■✓✔]/g, ON).trim();
}

function cellsOf(table: string): Cell[] {
  const cells: Cell[] = [];
  (table.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []).forEach((tr, r) => {
    let c = 0;
    for (const tc of tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []) {
      const span = +(tc.match(/<w:gridSpan w:val="(\d+)"/)?.[1] ?? 1);
      const lines = (tc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).flatMap((p) => para(p).split("\n")).map((l) => l.trim()).filter(Boolean);
      cells.push({ r, c, span, lines });
      c += span;
    }
  });
  return cells;
}

/** Country of origin cell: labelled, or (when the label was typed over) the cell right of "Is drawback required". */
function originCell(cells: Cell[], drawback: Cell | undefined): Cell | undefined {
  return cells.find((c) => /COUNTRY OF ORIGIN/i.test(c.lines.join(" ")))
    ?? (drawback ? cells.find((c) => c.r === drawback.r && c.c > drawback.c) : undefined);
}

/** True when the box right before `word` in this text is ticked. */
export function ticked(text: string, word: RegExp): boolean {
  const m = text.match(new RegExp(`([${ON}${OFF}])\\s*${word.source}`, "i"));
  return m?.[1] === ON;
}

/** Text left in a cell once its printed label is removed. */
function after(cell: Cell | undefined, label: RegExp): string[] {
  if (!cell) return [];
  const [first, ...rest] = cell.lines;
  const head = first.replace(label, "").replace(/^\s*\([^)]*\)\s*:?/, "").replace(/^\s*:/, "").trim();
  return [head, ...rest].filter(Boolean);
}

export function readSliDocx(bytes: Uint8Array): RawSli | null {
  const files = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" });
  const doc = files["word/document.xml"];
  if (!doc) return null;
  const xml = strFromU8(doc);
  if (!/LETTER\s+OF\s+INSTRUCTION/i.test(xml.replace(/<[^>]+>/g, ""))) return null;
  const table = (xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? []).find((t) => /SHIPPER/i.test(t) && /PIECES/i.test(t));
  if (!table) return null;
  const cells = cellsOf(table);
  const find = (re: RegExp) => cells.find((c) => re.test(c.lines.join(" ")));
  const below = (cell: Cell | undefined) => cell ? cells.find((c) => c.r === cell.r + 1 && c.c === cell.c)?.lines ?? [] : [];
  const block = (re: RegExp) => { const c = find(re); return [...after(c, re), ...below(c)]; };

  const shipperRe = /^SHIPPER\s*\/\s*SENDER/i, consRe = /^CONSIGNEE\s*\/\s*RECEIVER/i;
  const head = find(/NO\.?\s*OF\s*PIECES/i);
  const cargo: RawSli["cargo"] = [];
  const desc: string[] = [];
  if (head) {
    const col = (re: RegExp) => cells.find((c) => c.r === head.r && re.test(c.lines.join(" ")));
    const dims = col(/DIMENSIONS/i), gross = col(/GROSS/i), dsc = col(/DESCRIPTION/i);
    desc.push(...after(dsc, /DESCRIPTION\s*&?\s*MARKS/i));
    for (let r = head.r + 1; ; r++) {
      const row = cells.filter((c) => c.r === r);
      if (!row.length || row.some((c) => /DECLARED VALUE|PICK\s*UP|DANGEROUS GOODS\?/i.test(c.lines.join(" ")))) break;
      const at = (c?: number) => c == null ? [] : row.find((x) => x.c === c)?.lines ?? [];
      const pc = at(head.c), L = at(dims?.c), W = at(dims ? dims.c + 1 : undefined), H = at(dims ? dims.c + 2 : undefined), KG = at(gross?.c);
      // One-cell dims like "120x80x100" in the L column.
      const n = Math.max(pc.length, L.length, KG.length);
      for (let i = 0; i < n; i++) {
        const x = (L[i] ?? "").match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/i);
        cargo.push({ pcs: pc[i] ?? "", l: x ? x[1] : L[i] ?? "", w: x ? x[2] : W[i] ?? "", h: x ? x[3] : H[i] ?? "", kg: KG[i] ?? "" });
      }
      desc.push(...at(dsc?.c));
    }
  }
  const all = (re: RegExp) => find(re)?.lines.join(" ") ?? "";
  const pick = find(/PICK\s*UP\s*READY/i);
  const pickLine = pick?.lines.join(" ") ?? "";
  return {
    shipper: block(shipperRe).filter((l) => !/^\(?company, address/i.test(l)),
    consignee: block(consRe).filter((l) => !/^\(?company, address/i.test(l)),
    notify: after(find(/SPECIAL INSTRUCTIONS/i), /SPECIAL INSTRUCTIONS\s*\/?\s*NOTIFY PARTY/i),
    terms: after(find(/TERMS OF SHIPMENT/i), /TERMS OF SHIPMENT/i).join("\n"),
    dest: (all(/AIRPORT OF DESTINATION/i).match(/AIRPORT OF DESTINATION\s*:?\s*(.*?)(FLIGHT\s*#|$)/i)?.[1] ?? "").trim(),
    declared: (all(/DECLARED VALUE/i).match(/CURRENCY\s*\/\s*AMOUNT\s*:?\s*(.*)/i)?.[1] ?? "").trim(),
    origin: originCell(cells, find(/IS DRAWBACK/i))?.lines.join(" ").replace(/COUNTRY OF ORIGIN\s*:?/i, "").trim() ?? "",
    cargo, desc,
    pickupText: pickLine.replace(/^[☒☐\s]*PICK\s*UP\s*READY\s*AT\s*:?/i, "").trim(),
    pickupTicked: ticked(pickLine, /PICK\s*UP/),
    deliverTicked: ticked(all(/WILL BE DELIVERED/i), /FREIGHT WILL BE/),
    dgYes: ticked(all(/CONTAIN DANGEROUS GOODS/i), /YES/),
    insuranceYes: ticked(all(/INSURANCE REQUIRED/i), /YES/),
  };
}
