// Reads a UBF Air SLI saved or printed as PDF (text layer only; scans return null).
// Works from text positions: printed labels mark the boxes, the right column starts at "SHIPMENT TYPE".
import { getDocumentProxy } from "npm:unpdf@0.12.1";
import type { RawSli } from "./sliCommon.ts";

type Chunk = { x: number; x2: number; y: number; s: string };
const LABEL = /^(SHIPPER|CONSIGNEE|\(?Company, Address|:$|SHIP TO:?$|SPECIAL INSTRUCTIONS|DOCUMENTS ATTACHED|IS INSURANCE|IF UB FREIGHT|COVERED:?$|AIRPORT OF DESTINATION|FLIGHT|HAWB|TERMS OF SHIPMENT|\(INCO|SHIPMENT TYPE|PAYMENT DETAILS)/i;

async function pageItems(bytes: Uint8Array): Promise<Chunk[]> {
  const pdf = await getDocumentProxy(bytes);
  const page = await pdf.getPage(1);
  return ((await page.getTextContent()).items as { str?: string; transform: number[]; width: number }[])
    .filter((i) => i.str && i.str.trim())
    .map((i) => ({ x: i.transform[4], y: i.transform[5], x2: i.transform[4] + i.width, s: i.str! }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
}

function chunks(items: Chunk[], joinGap: number): Chunk[] {
  // Group into lines, then join pieces of words split by the PDF writer.
  const lines: (typeof items)[] = [];
  for (const it of items) {
    const line = lines.find((l) => Math.abs(l[0].y - it.y) <= 2.5);
    if (line) line.push(it); else lines.push([it]);
  }
  const out: Chunk[] = [];
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);
    let cur: Chunk | null = null;
    for (const it of line) {
      const gap = cur ? it.x - cur.x2 : 99;
      if (cur && gap < 1.2) { cur.s += it.s; cur.x2 = it.x2; }
      else if (cur && gap < joinGap) { cur.s += ` ${it.s}`; cur.x2 = it.x2; }
      else { if (cur) out.push(cur); cur = { x: it.x, x2: it.x2, y: line[0].y, s: it.s }; }
    }
    if (cur) out.push(cur);
  }
  return out.map((c) => ({ ...c, s: c.s.replace(/\s+/g, " ").trim() })).filter((c) => c.s);
}

export async function readSliPdf(bytes: Uint8Array): Promise<RawSli | null> {
  const items = await pageItems(bytes);
  const cs = chunks(items, 4.5);
  const fine = chunks(items, 1.2); // cargo grid: keep neighbouring cells apart
  const all = cs.map((c) => c.s).join(" ");
  if (!/LETTER\s*OF\s*INSTRUCTION/i.test(all) || !/SHIPPER/i.test(all)) return null;
  const at = (re: RegExp) => cs.find((c) => re.test(c.s));
  const yOf = (re: RegExp, dflt: number) => at(re)?.y ?? dflt;
  const xR = (at(/SHIPMENT TYPE/i)?.x ?? 300) - 3;
  const yShip = yOf(/SHIPPER\s*\/?\s*SENDE/i, 9999), yCons = yOf(/CONSIGNEE\s*\/?\s*RECEIV/i, 0);
  const ySpec = yOf(/SPECIAL INSTRUCTIONS/i, 0), yVol = yOf(/VOLUMENTATIC|VOLUMETRIC/i, 0);
  const yDecl = yOf(/DECLARED VALUE/i, 0), yPick = yOf(/PICK\s*U\s*P|PICK UP/i, 0);
  const left = (top: number, bottom: number) => cs.filter((c) => c.x < xR && c.y < top - 1 && c.y > bottom + 1);
  const text = (list: Chunk[]) => {
    const rows: Chunk[][] = [];
    for (const c of list) { const r = rows.find((x) => Math.abs(x[0].y - c.y) <= 2.5); if (r) r.push(c); else rows.push([c]); }
    return rows.map((r) => r.sort((a, b) => a.x - b.x).map((c) => c.s).join(" ")).filter((l) => !LABEL.test(l) && !/^[A-Z]{3}$/.test(l));
  };
  // Same-line text right of a label (and the label's own tail).
  const rightOf = (re: RegExp) => {
    const lab = at(re);
    if (!lab) return "";
    const tail = lab.s.replace(re, "").replace(/^[^A-Za-z0-9]*\(?time\s*\/\s*date\)?/i, "").trim();
    return [tail, ...cs.filter((c) => Math.abs(c.y - lab.y) <= 2.5 && c.x > lab.x2 && (lab.x >= xR ? true : c.x < xR)).map((c) => c.s)]
      .filter(Boolean).join(" ").trim();
  };
  const xBefore = (re: RegExp) => { const lab = at(re); return !!lab && cs.some((c) => /^x$/i.test(c.s) && Math.abs(c.y - lab.y) <= 3 && c.x < lab.x && lab.x - c.x2 < 30); };
  const yesTicked = (re: RegExp) => {
    const lab = at(re); const yes = lab && cs.find((c) => /^YES$/i.test(c.s) && c.y <= lab.y + 3 && c.y > lab.y - 25 && c.x > lab.x - 5);
    return !!yes && cs.some((c) => /^x$/i.test(c.s) && Math.abs(c.y - yes.y) <= 3 && c.x < yes.x && yes.x - c.x2 < 30);
  };

  // Cargo grid: columns from the header labels, rows from the numbers.
  const head = fine.find((c) => /NO\.?\s*OF/i.test(c.s));
  const cargo: RawSli["cargo"] = [], desc: string[] = [];
  if (head) {
    const hdr = fine.filter((c) => c.y <= head.y + 3 && c.y > head.y - 40);
    const colX = (re: RegExp) => { const h = hdr.find((c) => re.test(c.s)); return h ? (h.x + h.x2) / 2 : null; };
    const cols = { pcs: head.x + 10, l: colX(/^L$/), w: colX(/^W$/), h: colX(/^H$/), kg: colX(/^GROSS/i) };
    // Description column starts where the weight column ends (same half-gap as between H and weight).
    const dLab = hdr.find((c) => /DESCRIPTION/i.test(c.s));
    const kgEnd = cols.kg != null && cols.h != null ? cols.kg + Math.max(15, (cols.kg - cols.h) / 2) : null;
    const xDesc = Math.min(kgEnd ?? 9999, dLab?.x ?? xR);
    // Everything under the header row, minus the header's own labels (they can sit level with the first row).
    const HEAD = /^(L|W|H|\(?KGS\)?|\(?CM\)?|PIECES|WEIGHT|GROSS.*|DIMENSIONS.*|DESCRIPTION.*|NO\.? OF.*)$/i;
    const body = fine.filter((c) => c.y < head.y - 2 && c.y > yDecl + 1 && !HEAD.test(c.s));
    const grid = body.filter((c) => (c.x + c.x2) / 2 < xDesc && /\d|one|two|three|pallet|carton|box/i.test(c.s));
    const rows: Chunk[][] = [];
    for (const c of grid.sort((a, b) => b.y - a.y)) { const r = rows.find((x) => Math.abs(x[0].y - c.y) <= 7); if (r) r.push(c); else rows.push([c]); }
    for (const r of rows) {
      const cell = { pcs: "", l: "", w: "", h: "", kg: "" } as Record<keyof typeof cols, string>;
      const end: Partial<Record<keyof typeof cols, number>> = {};
      for (const c of r.sort((a, b) => a.x - b.x)) {
        const mid = (c.x + c.x2) / 2;
        const k = (Object.entries(cols).filter(([, v]) => v != null) as [keyof typeof cols, number][])
          .sort((a, b) => Math.abs(a[1] - mid) - Math.abs(b[1] - mid))[0]?.[0];
        if (!k) continue;
        // "1" + "04 kg" printed as separate runs stay one number.
        const tight = end[k] != null && c.x - end[k]! < 3 && /\d$/.test(cell[k]) && /^\d/.test(c.s);
        cell[k] = tight ? cell[k] + c.s : `${cell[k]} ${c.s}`.trim();
        end[k] = c.x2;
      }
      if (/x/i.test(cell.l) && !cell.w) { const m = cell.l.match(/([\d.]+)\s*[x×*]\s*([\d.]+)\s*[x×*]\s*([\d.]+)/i); if (m) [cell.l, cell.w, cell.h] = [m[1], m[2], m[3]]; }
      cargo.push(cell);
    }
    desc.push(...text(body.filter((c) => (c.x + c.x2) / 2 >= xDesc)));
  }
  const decl = cs.filter((c) => c.y < yDecl + 1 && c.y > yPick + 1);
  const xDraw = at(/IS\s*D\s*RAWBACK|DRAWBACK/i)?.x ?? xR, xOrig = at(/COUNTRY OF ORIGIN/i)?.x ?? 9999;
  return {
    shipper: text(left(yShip, yCons)),
    consignee: text(left(yCons, ySpec || yVol)),
    notify: ySpec ? text(left(ySpec, yVol)) : [],
    terms: [rightOf(/TERMS OF SHIPMENT:?/i), ...cs.filter((c) => /^(EXW|FCA|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)$/i.test(c.s)).map((c) => c.s)].join(" "),
    dest: rightOf(/AIRPORT OF DESTINATION:?/i) || text(cs.filter((c) => c.x >= xR && c.y < yOf(/AIRPORT OF DESTINATION/i, 0) && c.y > yOf(/FLIGHT/i, 0) + 1)).join(" "),
    declared: text(decl.filter((c) => c.x < xDraw - 2 && !/DECLARED|^CURRENCY\/AMOUNT:?$/i.test(c.s))).join(" ").replace(/CURRENCY\/AMOUNT:?/i, "").trim(),
    origin: decl.filter((c) => c.x >= xOrig - 5 && !/COUNTRY OF ORIGIN|^(X|YES|NO)$/i.test(c.s)).map((c) => c.s).join(" "),
    cargo, desc,
    pickupText: rightOf(/PICK\s*U\s*P\s*READY\s*AT/i),
    pickupTicked: xBefore(/PICK\s*U\s*P/i),
    deliverTicked: xBefore(/FREIGHT WILL BE/i),
    dgYes: yesTicked(/CONTAIN DANGEROUS GOODS/i),
    insuranceYes: yesTicked(/IS INSURANCE REQUIRED/i),
  };
}
