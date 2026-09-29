// xlsx is loaded on demand so it stays out of the main portal bundle.
const loadXlsx = () => import('xlsx')

export type Kind = 'products' | 'po'

/** Our field -> header names people actually use. Matching ignores case, spaces and punctuation. */
const ALIASES: Record<Kind, Record<string, string[]>> = {
  products: {
    sku: ['sku', 'item', 'itemcode', 'itemno', 'productcode', 'partno', 'partnumber', 'code', 'article', 'stockcode'],
    description: ['description', 'desc', 'productname', 'name', 'itemdescription', 'product'],
    category: ['category', 'group', 'productgroup', 'range'],
    supplier: ['supplier', 'vendor', 'manufacturer', 'factory'],
    hs_code: ['hscode', 'hs', 'tariff', 'tariffcode', 'hts'],
    unit_value: ['unitvalue', 'unitprice', 'price', 'cost', 'unitcost', 'fob'],
    currency: ['currency', 'cur', 'ccy'],
    unit_weight_kg: ['unitweightkg', 'weightkg', 'unitweight', 'weight', 'kg'],
    unit_cbm: ['unitcbm', 'cbm', 'volume', 'm3'],
    units_per_carton: ['unitspercarton', 'cartonqty', 'packqty', 'innerqty', 'unitsperctn'],
  },
  po: {
    po_number: ['ponumber', 'po', 'pono', 'purchaseorder', 'order', 'orderno', 'ordernumber'],
    supplier: ['supplier', 'vendor', 'factory'],
    order_date: ['orderdate', 'podate', 'date', 'ordered'],
    required_date: ['requireddate', 'readydate', 'cargoready', 'duedate', 'requestedeta', 'shipby', 'exfactory', 'needby'],
    currency: ['currency', 'cur', 'ccy'],
    sku: ['sku', 'item', 'itemcode', 'itemno', 'productcode', 'partno', 'code', 'article'],
    description: ['description', 'desc', 'productname', 'itemdescription', 'product'],
    qty: ['qty', 'quantity', 'orderqty', 'qtyordered', 'units', 'pcs'],
    unit_price: ['unitprice', 'price', 'unitcost', 'cost', 'fob'],
  },
}

export const REQUIRED: Record<Kind, string[]> = { products: ['sku'], po: ['po_number', 'sku', 'qty'] }

export const LABELS: Record<string, string> = {
  sku: 'SKU', description: 'Description', category: 'Category', supplier: 'Supplier', hs_code: 'HS code', unit_value: 'Unit value',
  currency: 'Currency', unit_weight_kg: 'Unit weight kg', unit_cbm: 'Unit m³', units_per_carton: 'Units per carton',
  po_number: 'PO number', order_date: 'Order date', required_date: 'Cargo ready date', qty: 'Quantity', unit_price: 'Unit price',
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')

export type Parsed = { rows: Record<string, unknown>[]; mapped: Record<string, string>; missing: string[]; total: number }

export async function parseSheet(file: File, kind: Kind): Promise<Parsed> {
  const XLSX = await loadXlsx()
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' })
  const headers = raw.length ? Object.keys(raw[0]) : []
  const mapped: Record<string, string> = {}
  for (const [field, names] of Object.entries(ALIASES[kind])) {
    const hit = headers.find((h) => norm(h) === norm(field)) ?? headers.find((h) => names.includes(norm(h)))
    if (hit) mapped[field] = hit
  }
  const rows = raw
    .map((r) => Object.fromEntries(Object.entries(mapped).map(([f, h]) => [f, String(r[h] ?? '').trim()])))
    .filter((r) => REQUIRED[kind].every((f) => r[f]))
  return { rows, mapped, missing: REQUIRED[kind].filter((f) => !mapped[f]), total: raw.length }
}

export async function downloadTemplate(kind: Kind): Promise<void> {
  const XLSX = await loadXlsx()
  const rows = kind === 'products'
    ? [{ SKU: 'TL-600-GRY', Description: 'Porcelain tile 600x600 grey', Category: 'Tiles', Supplier: 'Foshan GNT Ceramics', 'HS code': '6907.21', 'Unit value': 12.5, Currency: 'USD', 'Unit weight kg': 25, 'Unit m³': 0.018, 'Units per carton': 4 }]
    : [
        { 'PO number': 'PO-1001', Supplier: 'Foshan GNT Ceramics', 'Order date': '2026-08-01', 'Cargo ready date': '2026-09-15', Currency: 'USD', SKU: 'TL-600-GRY', Description: 'Porcelain tile 600x600 grey', Quantity: 1200, 'Unit price': 12.5 },
        { 'PO number': 'PO-1001', Supplier: 'Foshan GNT Ceramics', 'Order date': '2026-08-01', 'Cargo ready date': '2026-09-15', Currency: 'USD', SKU: 'TL-TRIM-10', Description: 'Tile trim 10mm', Quantity: 300, 'Unit price': 2.1 },
      ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), kind === 'products' ? 'Products' : 'PO lines')
  XLSX.writeFile(wb, kind === 'products' ? 'ubf-products-template.xlsx' : 'ubf-purchase-orders-template.xlsx')
}
