type Ref = { code: string; name?: string; country_code?: string }

export const SYSTEM_PROMPT =
  "You convert an ocean LCL (less-than-container-load) rate-card / tariff spreadsheet from a co-loader " +
  "(consolidator) into structured lane-rate lines for a freight forwarder.\n\n" +
  "The spreadsheet is given as rows of cells (row-major). Headers may span multiple rows, include merged " +
  "banner cells, and layouts vary a lot between co-loaders. Some sheets list one origin per row with a single " +
  "destination; others spread SEVERAL destination ports (e.g. Auckland, Wellington, Christchurch) ACROSS " +
  "COLUMNS for a single origin row.\n\n" +
  "Return ONLY valid, MINIFIED JSON (no markdown, no preamble, no extra whitespace) matching:\n" +
  '{"lines":[{"origin_port_code":"","raw_origin":"","dest_port_code":"","raw_dest":"","rate_per_wm":0,"min_charge":null,"currency_code":"","transit_days":null,"via":"","frequency":"","lane_charges":[{"code":"","label":"","per_wm":0}],"valid_from":null,"valid_to":null,"confidence":"green","note":""}]}\n\n' +
  "RULES:\n" +
  "- LCL freight is priced per W/M (revenue ton = max(CBM, weight in tonnes)). rate_per_wm is that per-w/m " +
  'ocean-freight number (labelled "Rate per w/m", "Rate w/m", "Ocean Freight per w/m", "Rate Per WM", etc). ' +
  'Strip currency symbols/commas -> plain number ("USD 126" -> 126).\n' +
  "- Emit ONE line per (origin POL x destination POD) cell that holds a real numeric w/m rate. UNPIVOT " +
  "multi-destination layouts: if an origin row shows rates under several destination-port columns, emit one " +
  "line per destination that actually has a rate. Treat '-', blank, 'N/A' as no rate -> skip that cell.\n" +
  '- min_charge: the "Minimum" / "Min" / "Min Rate" value for that lane; if there is no minimum column, null. ' +
  "It often equals rate_per_wm.\n" +
  "- lane_charges: per-lane surcharges the co-loader lists ALONGSIDE freight, expressed per w/m — e.g. BAF, " +
  "LSS, ETS, PSS, EBS, CAF, Emergency. For each such column that has a NON-ZERO value on the lane, add " +
  '{code (short UPPERCASE, e.g. "BAF"), label (as printed), per_wm (number)}. Omit zero/blank ones. ' +
  "Do NOT fold these into rate_per_wm; keep them separate.\n" +
  '- frequency: sailing frequency for the lane (e.g. "Weekly", "Fortnightly") if a frequency column or the ' +
  'service text indicates it, else "".\n' +
  '- via: transhipment / routing text if present (e.g. "Via Shanghai", "Melbourne"), else "".\n' +
  "- currency_code: from a currency column if present, else the card default.\n" +
  "- transit_days: integer if a transit column exists, else null.\n" +
  "- valid_from/valid_to: per-row validity columns if present (ISO yyyy-mm-dd), else null.\n" +
  "- Resolve POL->origin_port_code and POD->dest_port_code using the PORTS list and ALIASES. Always keep the " +
  "sheet's original text in raw_origin/raw_dest. Exact/alias match keeps confidence; fuzzy match -> 'amber'; " +
  "unresolved -> '' and 'red'.\n" +
  "- NEVER emit a line without a clear origin AND destination (resolved or at least raw). If a row/section has " +
  "no clear origin or destination port, skip it.\n" +
  "- SKIP everything that is not port-to-port ocean freight: ancillary / arrival / local / destination charge " +
  "blocks (PSC, Delivery Order, Tech Service Fee, on-carriage, unpack, CFS, terminal handling), agent/office " +
  "listings, CFS location lists, rate-search helpers, notes and T&C sheets. Those are NOT lane freight rates.\n" +
  "- confidence is the WORST of the per-field confidences for that line. Flag uncertainty rather than guess " +
  "silently; put anything odd in note.\n" +
  "- Follow the HOUSE RULES block for co-loader-specific conventions; they override these defaults."

export function buildUserContent(args: {
  sheet: string[][]
  card: { currency_code: string | null; co_loader_code: string | null; valid_from: string | null; valid_to: string | null }
  rulesText: string
  ports: Ref[]
  aliases: { alias: string; port_code: string }[]
}): string {
  const { sheet, card, rulesText, ports, aliases } = args
  const sheetText = sheet.slice(0, 400).map((r, i) => `${i}\t${r.map((c) => (c ?? '').toString()).join('\t')}`).join('\n')
  const portList = ports.map((p) => `${p.code}\t${p.name ?? ''}\t${p.country_code ?? ''}`).join('\n')
  const aliasList = aliases.length ? aliases.map((a) => `${a.alias} -> ${a.port_code}`).join('\n') : '(none yet)'
  return (
    `CARD CONTEXT\n- co-loader code: ${card.co_loader_code ?? '(none)'}\n- default currency: ${card.currency_code ?? '(none)'}\n- card validity: ${card.valid_from ?? '?'} to ${card.valid_to ?? '?'}\n\n` +
    `PORTS (code \\t name \\t country)\n${portList}\n\n` +
    `PORT ALIASES (alias -> code)\n${aliasList}\n\n` +
    `HOUSE RULES\n${rulesText || '(none)'}\n\n` +
    `SPREADSHEET ROWS (row-index \\t cells...)\n${sheetText}\n\nReturn the JSON now.`
  )
}
