import { useState } from 'react'
import * as XLSX from 'xlsx'
import { FileDown, Upload } from 'lucide-react'
import { computeSell, laneKey, money, type Line, type Product, type Rule } from './rateCardModel'

const HEAD = ['Mode', 'Origin', 'Destination', 'Container', 'Currency', 'Buy', 'Freight sell', 'Origin charges', 'Origin currency', 'Dest charges', 'Dest currency', 'Transit days', 'Via']
const EXAMPLE = [
  ['FCL', 'CNSHA', 'NZAKL', '40HC', 'USD', 2480, '', 185, 'USD', 640, 'NZD', 18, ''],
  ['LCL', 'CNNGB', 'NZAKL', '', 'USD', 45, 60, 38, 'USD', 96, 'NZD', 24, ''],
  ['AIR', 'PVG', 'AKL', '', 'NZD', '', 4.1, 0.35, 'NZD', 0.48, 'NZD', 3, ''],
]

type Props = { rules: Partial<Record<Product, Rule>>; existing: Set<string>; nextSort: number; onRows: (lines: Line[]) => void }

const s = (v: unknown) => String(v ?? '').trim()
const n = (v: unknown) => { const x = s(v).replace(/[^\d.-]/g, ''); return x === '' ? null : Number(x) }

export function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([HEAD, ...EXAMPLE])
  ws['!cols'] = HEAD.map((h) => ({ wch: Math.max(10, h.length + 2) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Lanes')
  XLSX.writeFile(wb, 'UBF rate card lanes template.xlsx')
}

/** Read lanes from an Excel sheet. Blank freight sell = priced from buy with the customer's rule. */
export default function ExcelLanesImport({ rules, existing, nextSort, onRows }: Props) {
  const [rows, setRows] = useState<Line[]>([])
  const [errors, setErrors] = useState<string[]>([])

  async function read(f: File | undefined) {
    if (!f) return
    const wb = XLSX.read(await f.arrayBuffer())
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    const out: Line[] = []; const errs: string[] = []
    data.forEach((r, i) => {
      const get = (k: string) => r[Object.keys(r).find((x) => x.trim().toLowerCase() === k.toLowerCase()) ?? k]
      const mode = s(get('Mode')).toUpperCase().replace('AIRFREIGHT', 'AIR') as Product
      if (!mode && !s(get('Origin'))) return
      if (!['FCL', 'LCL', 'AIR'].includes(mode)) { errs.push(`Row ${i + 2}: mode must be FCL, LCL or AIR`); return }
      const origin = s(get('Origin')).toUpperCase(), dest = s(get('Destination')).toUpperCase()
      if (!origin || !dest) { errs.push(`Row ${i + 2}: origin and destination needed`); return }
      const cur = s(get('Currency')).toUpperCase() || 'USD'
      const buy = n(get('Buy')), sell = n(get('Freight sell'))
      if (buy == null && sell == null) { errs.push(`Row ${i + 2}: needs a buy or a freight sell`); return }
      const base: Line = {
        sort: nextSort + out.length, product: mode, origin_code: origin, dest_code: dest,
        container_type: mode === 'FCL' ? (s(get('Container')).toUpperCase() || '40HC') : null, carrier: null,
        transit_days: n(get('Transit days')), via: s(get('Via')) || null, frequency: null,
        source_table: null, source_line_id: null, source_card_id: null, buy, buy_currency: buy == null ? null : cur,
        margin_method: sell != null ? 'sell' : 'rule', margin_value: null, freight_sell: sell, sell_min: null, sell_currency: cur,
        origin_sell: n(get('Origin charges')), origin_currency: s(get('Origin currency')).toUpperCase() || cur,
        dest_sell: n(get('Dest charges')), dest_currency: s(get('Dest currency')).toUpperCase() || 'NZD', show: true, notes: null,
      }
      out.push(sell != null ? base : { ...base, freight_sell: computeSell(base, rules[mode] ?? null) })
    })
    setRows(out); setErrors(errs); onRows(out)
  }

  const dups = rows.filter((l) => existing.has(laneKey(l))).length
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn btn--inline cursor-pointer"><Upload size={14} /> Choose Excel file
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => void read(e.target.files?.[0])} /></label>
        <button type="button" className="btn btn--inline" onClick={downloadTemplate}><FileDown size={14} /> Template</button>
        <span className="text-[11.5px] text-[#5B6474]">Columns: {HEAD.join(', ')}. Blank freight sell uses the customer's margin rule on the buy.</span>
      </div>
      {errors.length > 0 && <div className="rounded-lg bg-[#FEF3F2] px-3 py-2 text-[12px] text-[#B42318]">{errors.slice(0, 6).join(' · ')}{errors.length > 6 ? ` · and ${errors.length - 6} more` : ''}</div>}
      {rows.length > 0 && (
        <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-[#E6E8EE]">
          <table className="data-table">
            <thead><tr><th>Mode</th><th>Lane</th><th>Unit</th><th style={{ textAlign: 'right' }}>Buy</th><th style={{ textAlign: 'right' }}>Freight sell</th><th style={{ textAlign: 'right' }}>Origin</th><th style={{ textAlign: 'right' }}>Dest</th></tr></thead>
            <tbody>{rows.map((l, i) => (
              <tr key={i} style={{ opacity: existing.has(laneKey(l)) ? 0.5 : 1 }}>
                <td>{l.product}</td><td className="font-mono text-[12px]">{l.origin_code} &gt; {l.dest_code}</td><td>{l.container_type ?? '–'}</td>
                <td className="text-right">{money(l.buy, l.buy_currency)}</td><td className="text-right">{money(l.freight_sell, l.sell_currency)}</td>
                <td className="text-right">{money(l.origin_sell, l.origin_currency)}</td><td className="text-right">{money(l.dest_sell, l.dest_currency)}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {dups > 0 && <span className="text-[11.5px] text-[#B54708]">{dups} lane{dups > 1 ? 's are' : ' is'} already on the card. They will be added again; remove the old ones after.</span>}
    </div>
  )
}
