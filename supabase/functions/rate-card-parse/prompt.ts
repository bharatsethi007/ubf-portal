type Ref = { code: string; name?: string; label?: string; country_code?: string }

export const SYSTEM_PROMPT =
  "You convert ONE sheet (or one chunk of a sheet) of an ocean freight FCL rate workbook into structured data for a freight forwarder.\n\n" +
  "The sheet is given as rows of cells (row-major). Headers may span several rows with merged/banner cells. Layouts vary. " +
  "A chunk may start mid-table: the first rows given are the sheet's header rows, then the chunk's rows.\n\n" +
  "Return ONLY minified JSON (no markdown, no preamble) with three arrays. Use these SHORT keys exactly:\n" +
  '{"lines":[{"o":"","ro":"","d":[""],"rd":"","c":"","rc":"","b":null,"s":null,"cur":"","tt":{},"via":"","car":"","vf":null,"vt":null,"cf":"green","n":""}],' +
  '"surcharges":[{"code":"","label":"","a":0,"cur":"","basis":"per_container","c":null,"scope":"freight","o":null,"car":null,"cond":""}],' +
  '"local":[{"port":"","dir":"dest","car":"","code":"","label":"","basis":"per_container","size":"all","a":0,"cur":""}]}\n\n' +
  "LINES (port-to-port freight):\n" +
  "- One object per (origin x rate row x container type). d = ALL destination port codes the row applies to (e.g. 'AKL / LYT / NPE / TRG' -> 4 codes). " +
  "tt = transit days per destination code if given (e.g. {\"NZAKL\":18,\"NZLYT\":21}); a single transit value applies to the first destination only.\n" +
  "- o = origin UN/LOCODE (5 letters). Use PORTS and ALIASES first; if not listed, use your best knowledge of the real UN/LOCODE and set cf 'amber'. " +
  "Rows naming two origins ('SHENZHEN,YANTIAN', 'Nhava Sheva/Chennai', 'YANTIAN, SHEKOU') -> one object per real port; 'SHENZHEN,YANTIAN' means Yantian only. " +
  "Keep the sheet text in ro/rd. Unknown origin -> o '' and cf 'red' (still emit).\n" +
  "- c = canonical container code from the ALLOWED list. A column covering two types (e.g. '40GP/HC', '40GP & 40HC', '40FT') -> emit BOTH 40GP and 40HQ objects. " +
  "'NOR' columns -> 20NOR / 40NOR.\n" +
  "- b = BUY (net/cost) rate, s = SELL rate. If the sheet has both a cost column and a 'SELL' column for the same container, fill both. " +
  "If only one rate column exists, put it in b unless HOUSE RULES or headers say it is a sell rate. Plain numbers only. '-', blank, 'N/A', text like 'suspended' -> skip.\n" +
  "- car = shipping line CODE from the CARRIERS list when the row names a carrier (e.g. 'MSK' -> MAERSK). Empty when the whole sheet is one carrier.\n" +
  "- via = routing/transhipment/service text if present. vf/vt = row validity as yyyy-mm-dd if present.\n" +
  "- cf = worst confidence for the object (green/amber/red). n = short note when amber/red.\n\n" +
  "SURCHARGES (charges on top of freight: FAF, BAF, EFS, PSS, GRI, WRS, ORS, ISPS, LSS, low sulphur, peak season, etc.):\n" +
  "- From surcharge columns or notes. One object per distinct (charge x container type x origin). a = amount as number in cur.\n" +
  "- basis: per_container | per_teu | per_bl | percent | flat. A 'per TEU' amount -> basis per_container with 20' = amount and 40' = 2x amount (two objects).\n" +
  "- c = container code or null for all. o = origin code when the charge only applies to that origin (e.g. a per-row ISPS column), else null. " +
  "car = carrier code when the charge belongs to one carrier only. scope: freight | origin | dest.\n" +
  "- cond = condition text for conditional charges (e.g. 'Saudi Arabia only'). Skip charges marked 'included'.\n\n" +
  "LOCAL (terminal/port/destination or origin charges by port: THC/THD, infrastructure levy, port security, doc fee, delivery order, container service charge, etc.):\n" +
  "- One object per (port x carrier x charge x size). port = UN/LOCODE of the port the charge is collected at (e.g. Auckland -> NZAKL). " +
  "A table header like 'Destination charges (NZAKL)' gives the port. Levy tables for several ports (e.g. 'Tauranga Infrastructure Levy') -> that port.\n" +
  "- dir: dest for import destination charges, origin for origin charges. size: '20', '40' or 'all'. basis: per_container | per_bl | per_shipment.\n" +
  "- car = carrier code for that column (tables often have one column pair per carrier).\n\n" +
  "Skip totals rows, notes that are not charges, and anything not in the three shapes. Follow HOUSE RULES; they override defaults. " +
  "If the chunk has nothing, return {\"lines\":[],\"surcharges\":[],\"local\":[]}."

export function buildUserContent(args: {
  sheet: string[][]
  card: { currency_code: string | null; shipping_line_code: string | null; valid_from: string | null; valid_to: string | null; sheet_name?: string | null }
  rulesText: string
  containers: Ref[]
  carriers: Ref[]
  ports: Ref[]
  aliases: { alias: string; port_code: string }[]
}): string {
  const { sheet, card, rulesText, containers, carriers, ports, aliases } = args
  const sheetText = sheet.slice(0, 400).map((r, i) => `${i}\t${r.map((c) => (c ?? '').toString()).join('\t')}`).join('\n')
  const containerList = containers.map((c) => `${c.code} = ${c.label ?? ''}`).join('\n')
  const carrierList = carriers.map((c) => `${c.code} = ${c.name ?? ''}`).join('\n')
  const portList = ports.map((p) => `${p.code}\t${p.name ?? ''}\t${p.country_code ?? ''}`).join('\n')
  const aliasList = aliases.length ? aliases.map((a) => `${a.alias} -> ${a.port_code}`).join('\n') : '(none yet)'
  return (
    `CONTEXT\n- sheet: ${card.sheet_name ?? '(unnamed)'}\n- default carrier: ${card.shipping_line_code ?? '(none)'}\n- default currency: ${card.currency_code ?? '(none)'}\n` +
    `- validity: ${card.valid_from ?? '?'} to ${card.valid_to ?? '?'}\n\n` +
    `ALLOWED container codes\n${containerList}\n\nCARRIERS (code = name)\n${carrierList}\n\n` +
    `PORTS (code \\t name \\t country) - main ports only; other real UN/LOCODEs are allowed\n${portList}\n\n` +
    `PORT ALIASES (alias -> code)\n${aliasList}\n\nHOUSE RULES\n${rulesText || '(none)'}\n\n` +
    `SHEET ROWS (row-index \\t cells...)\n${sheetText}\n\nReturn the JSON now.`
  )
}
