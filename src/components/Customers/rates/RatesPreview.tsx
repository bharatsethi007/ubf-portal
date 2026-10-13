import { useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import SeaPortCell from '@/components/SeaPortCell'
import AirportCell from '@/pages/rates/air/AirportCell'
import { useContainerTypes } from '@/hooks/useQuoteRefData'
import { previewCustomerRates, type PreviewOption, type PreviewQuery } from './customerRatesApi'

const money = (v: number | null, c: string) => (v == null ? null : `${c} ${v.toLocaleString('en-NZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`)
const fmtDate = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }) : '')

/** Staff run the portal rate search as this customer: same prices, same visibility. */
export default function RatesPreview({ accountId }: { accountId: string }) {
  const [q, setQ] = useState<PreviewQuery>({ mode: 'sea', load: 'FCL', container: '', origin: '', destination: '' })
  const [rows, setRows] = useState<PreviewOption[] | null>(null)
  const [busy, setBusy] = useState(false)
  const { items: containers } = useContainerTypes()
  const set = (p: Partial<PreviewQuery>) => setQ((x) => ({ ...x, ...p }))

  async function run() {
    if (!q.origin || !q.destination) { toast.error('Pick origin and destination'); return }
    setBusy(true)
    try { setRows(await previewCustomerRates(accountId, q)) } catch (e) { toast.error(e instanceof Error ? e.message : 'Search failed') } finally { setBusy(false) }
  }

  const Port = q.mode === 'air' ? AirportCell : SeaPortCell
  return (
    <section className="cp-card">
      <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600 }}>Search as this customer</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <select className="input input--sm" style={{ width: "auto" }} value={q.mode === 'air' ? 'AIR' : q.load} aria-label="Service"
          onChange={(e) => { const v = e.target.value; set(v === 'AIR' ? { mode: 'air', origin: '', destination: '' } : { mode: 'sea', load: v as 'FCL' | 'LCL', ...(q.mode === 'air' ? { origin: '', destination: '' } : {}) }); setRows(null) }}>
          <option value="FCL">Sea FCL</option><option value="LCL">Sea LCL</option><option value="AIR">Air</option>
        </select>
        <Port key={`o-${q.mode}`} value={q.origin} onChange={(c) => set({ origin: c })} width={190} />
        <span className="text-muted-foreground">→</span>
        <Port key={`d-${q.mode}`} value={q.destination} onChange={(c) => set({ destination: c })} width={190} />
        {q.mode === 'sea' && q.load === 'FCL' && (
          <select className="input input--sm" style={{ width: "auto" }} value={q.container} onChange={(e) => set({ container: e.target.value })} aria-label="Container">
            <option value="">All containers</option>
            {containers.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        )}
        <button type="button" className="btn quotes-page__new-btn" onClick={() => void run()} disabled={busy} aria-label="Search" title="Search">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        </button>
      </div>

      {rows && (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data-table">
            <thead><tr><th>Carrier</th><th>Service</th><th>Sell</th><th>Others pay</th><th>Min</th><th>Transit</th><th>Valid to</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ref}>
                  <td>{r.carrier ?? '-'}</td>
                  <td>{r.product}{r.container_type ? ` · ${r.container_type}` : ''}</td>
                  <td style={{ fontWeight: 600 }}>{money(r.sell, r.currency) ?? <span className="text-muted-foreground">On request</span>} <span className="text-muted-foreground" style={{ fontWeight: 400, fontSize: 12 }}>{r.sell != null ? r.unit : ''}</span></td>
                  <td>
                    {r.public_sell == null ? <span className="text-muted-foreground">{r.contract ? 'Private' : '-'}</span> : (
                      <span style={{ color: r.sell != null && r.sell > r.public_sell ? '#b45309' : undefined }}
                        title={r.sell != null && r.sell > r.public_sell ? 'This customer pays more than the public price' : undefined}>
                        {money(r.public_sell, r.currency)}{r.sell != null && r.sell > r.public_sell ? ' ▲' : ''}
                      </span>
                    )}
                  </td>
                  <td>{money(r.sell_min, r.currency) ?? ''}</td>
                  <td>{r.transit_days ? `${r.transit_days} d` : ''}{r.via ? ` via ${r.via}` : ''}</td>
                  <td>{fmtDate(r.valid_to)}</td>
                  <td>{r.contract && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: '#0A2472', color: '#fff' }}>Contract</span>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="text-muted-foreground pad-inline">No rates on this lane. Customer would see "Get a price".</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
