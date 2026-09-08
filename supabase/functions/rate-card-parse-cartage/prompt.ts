type Zone = { zone_code: string; name: string; zone_type: string }
type Band = { band_code: string; min_kg: number; max_kg: number | null }

export const SYSTEM_PROMPT =
  "You convert a DOMESTIC CARTAGE (trucking) rate-card spreadsheet into structured cartage rates for a freight forwarder.\n\n" +
  "There are TWO rate kinds:\n" +
  "- FCL cartage: a flat rate to move a 20ft or 40ft container between two zones. Columns are usually '20' and '40' (or 20ft/40ft).\n" +
  "- LTL cartage: loose freight priced by weight band ($/kg per weight break) and/or per CBM. Weight-break columns look like '0-50', '50-100', '250-500', '1000+' kg.\n\n" +
  "The sheet is rows of cells (row-major). Header rows may span multiple rows or have banner cells; layouts vary.\n\n" +
  "Return ONLY valid, MINIFIED JSON (no markdown, no preamble) matching:\n" +
  '{"fcl_lines":[{"direction":"export","raw_origin":"","origin_zone_code":"","raw_dest":"","dest_zone_code":"","container_size":"20","base_rate":0,"min_charge":null,"confidence":"green","note":""}],"ltl_lanes":[{"direction":"export","raw_origin":"","origin_zone_code":"","raw_dest":"","dest_zone_code":"","min_charge":null,"per_cbm":null,"band_rates":[{"band_code":"","per_kg":0}],"confidence":"green","note":""}]}\n\n' +
  "RULES:\n" +
  "- direction: 'export' = pickup from a shipper door TO a port/depot; 'import' = delivery FROM a port/depot to a consignee door. Infer from sheet headings/columns; if unclear default 'export' and set confidence 'amber'.\n" +
  "- Resolve each origin/destination text to a ZONE CODE from the ZONES list, using ZONE ALIASES. Keep the sheet's original text in raw_origin/raw_dest. Exact/alias match keeps confidence; fuzzy -> 'amber'; unresolved -> leave the *_zone_code empty and set confidence 'red'.\n" +
  "- A port/depot end usually maps to a zone whose type is 'port' or 'depot'. The door end maps to an 'area' zone.\n" +
  "- FCL: emit ONE fcl_line per (origin x dest x size) cell with a real numeric rate. container_size is exactly '20' or '40'. Map '20ft','20'->'20'; '40ft','40','40hc','40hq'->'40' (40hc/hq -> '40', confidence 'amber').\n" +
  "- LTL: emit ONE ltl_lane per (origin x dest). Put each weight-break column's $/kg into band_rates, mapping the break to a BAND CODE from the BANDS list by matching the kg range. If a per-CBM or per-m3 column exists, put it in per_cbm. min_charge from a 'min'/'minimum' column if present.\n" +
  "- If a weight break can't be matched to a band, omit that band_rate and set the lane confidence 'amber'.\n" +
  "- Strip currency symbols/commas -> plain numbers ('$1,250.00' -> 1250). Treat '-', blank, 'N/A' as no value.\n" +
  "- Skip surcharge/accessorial rows here (FAF, tail lift, residential, heavy) - those are handled separately. Skip heading/legend/notes rows.\n" +
  "- confidence per line/lane is the WORST of its field confidences. Flag uncertainty rather than guess silently.\n" +
  "- If the sheet has only FCL rates, return ltl_lanes: []. If only LTL, return fcl_lines: []."

export function buildUserContent(args: {
  sheet: string[][]
  card: { currency_code: string | null; vendor_name: string | null; valid_from: string | null; valid_to: string | null }
  rulesText: string
  zones: Zone[]
  bands: Band[]
  aliases: { alias: string; zone_code: string }[]
}): string {
  const { sheet, card, rulesText, zones, bands, aliases } = args
  const sheetText = sheet.slice(0, 400).map((r, i) => `${i}\t${r.map((c) => (c ?? '').toString()).join('\t')}`).join('\n')
  const zoneList = zones.map((z) => `${z.zone_code}\t${z.name}\t${z.zone_type}`).join('\n')
  const bandList = bands.map((b) => `${b.band_code}\t${b.min_kg}-${b.max_kg ?? '+'} kg`).join('\n')
  const aliasList = aliases.length ? aliases.map((a) => `${a.alias} -> ${a.zone_code}`).join('\n') : '(none yet)'
  return (
    `CARD CONTEXT\n- vendor: ${card.vendor_name ?? '(none)'}\n- default currency: ${card.currency_code ?? '(none)'}\n- card validity: ${card.valid_from ?? '?'} to ${card.valid_to ?? '?'}\n\n` +
    `ZONES (code \\t name \\t type)\n${zoneList || '(none defined)'}\n\n` +
    `WEIGHT BANDS (code \\t range)\n${bandList || '(none defined)'}\n\n` +
    `ZONE ALIASES (alias -> code)\n${aliasList}\n\n` +
    `HOUSE RULES\n${rulesText || '(none)'}\n\n` +
    `SPREADSHEET ROWS (row-index \\t cells...)\n${sheetText}\n\nReturn the JSON now.`
  )
}
