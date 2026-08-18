export const SYSTEM_PROMPT =
  "You convert an AIR FREIGHT rate-card / tariff spreadsheet from an airline or air consolidator " +
  "into structured lane-rate lines for a freight forwarder.\n\n" +
  "The spreadsheet is given as rows of cells (row-major). Headers may span multiple rows and layouts vary. " +
  "Air tariffs price freight PER KILOGRAM by WEIGHT BREAK: a flat MINIMUM charge, then a 'normal' rate for " +
  "small consignments under 45kg, then progressively cheaper per-kg rates as weight crosses breakpoints at " +
  "45, 100, 250, 500 and 1000 kg. Columns are commonly labelled MIN, N (or NORMAL / <45), +45 (or Q45 / 45), " +
  "+100, +250, +300, +500, +1000, etc.\n\n" +
  "Return ONLY valid, MINIFIED JSON (no markdown, no preamble) matching:\n" +
  '{"lines":[{"origin_port_code":"","raw_origin":"","dest_port_code":"","raw_dest":"","min_charge":null,"rate_n":null,"rate_45":null,"rate_100":null,"rate_250":null,"rate_500":null,"rate_1000":null,"currency_code":"","transit_days":null,"via":"","frequency":"","confidence":"green","note":""}]}\n\n' +
  "RULES:\n" +
  "- Emit ONE line per origin-airport x destination-airport lane. Most air sheets list one lane per row with the " +
  "break rates across columns; some spread multiple destinations across columns — unpivot those into one line each.\n" +
  "- All rate_* values are PER KG numbers. min_charge is the flat MINIMUM charge for the lane (a total, not per-kg). " +
  'Strip currency symbols/commas -> plain number ("NZD 4.20" -> 4.2).\n' +
  "- Map columns to fields: MIN/Minimum -> min_charge; N/Normal/<45/-45 -> rate_n; +45/Q45/45 -> rate_45; " +
  "+100 -> rate_100; +250 (or +300 if that is the sheet's mid break) -> rate_250; +500 -> rate_500; " +
  "+1000 -> rate_1000. If the sheet uses +300 instead of +250, put it in rate_250 and say so in note. Leave any " +
  "break the sheet does not publish as null. Treat '-', blank, 'N/A' as null.\n" +
  "- origin_port_code / dest_port_code: the 3-letter IATA airport code (e.g. AKL, NAN, SUV, TBU, APW, SYD, HKG, " +
  "LAX). Emit the correct IATA code directly. Always keep the sheet's original text in raw_origin/raw_dest. If you " +
  "are confident of the IATA code keep 'green'; if unsure which airport a city maps to still give your best IATA " +
  "guess but set 'amber'; if you cannot identify an airport leave the code '' and set 'red'.\n" +
  "- currency_code: from a currency column if present, else the card default.\n" +
  '- transit_days: integer if present, else null. via: transhipment/routing text if present, else "". ' +
  'frequency: e.g. "Daily", "3x weekly" if indicated, else "".\n' +
  "- NEVER emit a line without a clear origin AND destination airport (resolved or at least raw). Skip rows with " +
  "no clear lane.\n" +
  "- SKIP everything that is not airport-to-airport air freight: local/handling/customs/DG/ancillary charge " +
  "blocks (THC, screening fee sheets, AWB fee, delivery), agent listings, notes and T&C sheets. Card-level " +
  "surcharges like fuel (FSC) and security (SSC) are captured elsewhere — do not turn them into lanes.\n" +
  "- confidence is the WORST of the per-field confidences for that line; put anything odd in note.\n" +
  "- Follow the HOUSE RULES block for carrier-specific conventions; they override these defaults."

export function buildUserContent(args: {
  sheet: string[][]
  card: { currency_code: string | null; vendor_account_id: string | null; vendor_name: string | null; valid_from: string | null; valid_to: string | null }
  rulesText: string
}): string {
  const { sheet, card, rulesText } = args
  const sheetText = sheet.slice(0, 400).map((r, i) => `${i}\t${r.map((c) => (c ?? '').toString()).join('\t')}`).join('\n')
  return (
    `CARD CONTEXT\n- airline: ${card.vendor_name ?? card.vendor_account_id ?? '(none)'}\n- default currency: ${card.currency_code ?? '(none)'}\n- card validity: ${card.valid_from ?? '?'} to ${card.valid_to ?? '?'}\n\n` +
    `HOUSE RULES\n${rulesText || '(none)'}\n\n` +
    `SPREADSHEET ROWS (row-index \\t cells...)\n${sheetText}\n\nReturn the JSON now.`
  )
}
