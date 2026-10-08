import { money, type QuoteResponseLine } from '@/features/quoteBooking/quoteBookingApi'

const GROUP_ORDER = ['freight', 'origin', 'destination']
const GROUP_LABEL: Record<string, string> = { freight: 'Freight', origin: 'Origin', destination: 'Destination' }

function groupLines(lines: QuoteResponseLine[]) {
  const m = new Map<string, QuoteResponseLine[]>()
  for (const l of lines) {
    const g = (l.charge_group ?? 'other').toLowerCase()
    m.set(g, [...(m.get(g) ?? []), l])
  }
  const keys = [...m.keys()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a); const ib = GROUP_ORDER.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
  return keys.map((k) => ({ key: k, label: GROUP_LABEL[k] ?? k, rows: m.get(k) ?? [] }))
}

export default function FinanceQuoteLines({ lines, currency }: { lines: QuoteResponseLine[]; currency: string | null }) {
  if (lines.length === 0) return <p className="text-muted-foreground pad-inline">Quote response has no charge lines.</p>
  const groups = groupLines(lines)
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Charge</th><th>Vendor</th><th style={{ textAlign: 'right' }}>Qty</th><th>Unit</th>
            <th style={{ textAlign: 'right' }}>Buy rate</th><th style={{ textAlign: 'right' }}>Sell rate</th>
            <th style={{ textAlign: 'right' }}>Total buy ({currency ?? 'NZD'})</th><th style={{ textAlign: 'right' }}>Total sell ({currency ?? 'NZD'})</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <GroupRows key={g.key} label={g.label} rows={g.rows} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GroupRows({ label, rows }: { label: string; rows: QuoteResponseLine[] }) {
  const buy = rows.reduce((s, r) => s + Number(r.total_buy ?? 0), 0)
  const sell = rows.reduce((s, r) => s + Number(r.total_sell ?? 0), 0)
  return (
    <>
      <tr style={{ background: '#F8FAFC' }}>
        <td colSpan={6} style={{ fontWeight: 500 }}>{label}</td>
        <td style={{ textAlign: 'right' }}>{money(buy)}</td>
        <td style={{ textAlign: 'right' }}>{money(sell)}</td>
      </tr>
      {rows.map((r) => (
        <tr key={r.id}>
          <td>{r.description ?? '-'}</td>
          <td>{r.vendor ?? <span className="text-muted-foreground">-</span>}</td>
          <td style={{ textAlign: 'right' }}>{r.qty ?? '-'}</td>
          <td>{r.unit ?? '-'}</td>
          <td style={{ textAlign: 'right' }}>{money(r.buy_rate, r.buy_currency)}</td>
          <td style={{ textAlign: 'right' }}>{money(r.sell_rate, r.sell_currency)}</td>
          <td style={{ textAlign: 'right' }}>{money(r.total_buy)}</td>
          <td style={{ textAlign: 'right' }}>{money(r.total_sell)}</td>
        </tr>
      ))}
    </>
  )
}
