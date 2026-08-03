type Ref = { code: string; name?: string; label?: string; country_code?: string }

export const SYSTEM_PROMPT =
  "You convert an ocean freight (FCL) rate-card spreadsheet into structured lane-rate lines for a freight forwarder.\n\n" +
  "The spreadsheet is given as rows of cells (row-major). Headers may span multiple rows and contain merged/banner cells " +
  "(e.g. a 'Freight' or carrier-name band above the real column headers), and layouts vary between carriers.\n\n" +
  "Return ONLY valid, MINIFIED JSON (no markdown, no preamble, no extra whitespace) matching:\n" +
  '{"lines":[{"origin_port_code":"","raw_origin":"","dest_port_code":"","raw_dest":"","container_type":"","raw_container":"","base_rate":0,"currency_code":"","transit_days":null,"via":"","valid_from":null,"valid_to":null,"confidence":"green","note":""}]}\n\n' +
  "RULES:\n" +
  "- Emit ONE line per (origin POL x destination POD x container-rate column) cell that holds a real numeric rate.\n" +
  "- Treat '-', blank, 'N/A' as no rate -> skip that cell.\n" +
  "- base_rate: strip currency symbols/commas -> plain number (\"$2,325.00\" -> 2325).\n" +
  "- Container columns: map each header to ONE canonical container_type CODE from the allowed list. " +
  "If a header combines two (e.g. '40GP/HC'), pick the closest canonical code and set confidence 'amber'. " +
  "If no canonical code fits (e.g. 'NOR' non-operating reefer), set container_type '', put the header in raw_container, confidence 'red'.\n" +
  "- Ignore surcharge/adjustment columns (FAF, BAF, WRS, ORS, LSS, etc.) - those are NOT lane base rates.\n" +
  "- ONLY parse the main port-to-port freight rate table (origin POL -> destination POD with per-container rates). SKIP local/destination/terminal charge blocks entirely (e.g. sections titled 'Destination charges', 'Local charges', Terminal Handling/THC, Infrastructure Levy, Security Surcharge) - those are NOT lane freight rates.\n" +
  "- NEVER emit a line without a resolvable origin POL. If a row or section has no clear origin port, skip it.\n" +
  "- Resolve POL->origin_port_code and POD->dest_port_code using the PORTS list and ALIASES. " +
  "Always keep the sheet's original text in raw_origin/raw_dest. Exact/alias match keeps confidence; fuzzy match -> 'amber'; unresolved -> '' and 'red'.\n" +
  "- currency_code: from a CURRENCY column if present, else the card default.\n" +
  "- valid_from/valid_to: per-row validity columns if present (ISO yyyy-mm-dd), else null.\n" +
  "- transit_days: integer if a transit column exists, else null. via: transhipment port text if present, else ''.\n" +
  "- confidence is the WORST of the per-field confidences for that line. Flag uncertainty rather than guess silently.\n" +
  "- Follow the HOUSE RULES block for carrier-specific conventions; they override defaults."

export function buildUserContent(args: {
  sheet: string[][]
  card: { currency_code: string | null; shipping_line_code: string; valid_from: string | null; valid_to: string | null }
  rulesText: string
  containers: Ref[]
  ports: Ref[]
  aliases: { alias: string; port_code: string }[]
}): string {
  const { sheet, card, rulesText, containers, ports, aliases } = args
  const sheetText = sheet.slice(0, 400).map((r, i) => `${i}\t${r.map((c) => (c ?? '').toString()).join('\t')}`).join('\n')
  const containerList = containers.map((c) => `${c.code} = ${c.label ?? ''}`).join('\n')
  const portList = ports.map((p) => `${p.code}\t${p.name ?? ''}\t${p.country_code ?? ''}`).join('\n')
  const aliasList = aliases.length ? aliases.map((a) => `${a.alias} -> ${a.port_code}`).join('\n') : '(none yet)'
  return (
    `CARD CONTEXT\n- carrier code: ${card.shipping_line_code}\n- default currency: ${card.currency_code ?? '(none)'}\n- card validity: ${card.valid_from ?? '?'} to ${card.valid_to ?? '?'}\n\n` +
    `ALLOWED container_type CODES\n${containerList}\n\n` +
    `PORTS (code \\t name \\t country)\n${portList}\n\n` +
    `PORT ALIASES (alias -> code)\n${aliasList}\n\n` +
    `HOUSE RULES\n${rulesText || '(none)'}\n\n` +
    `SPREADSHEET ROWS (row-index \\t cells...)\n${sheetText}\n\nReturn the JSON now.`
  )
}
