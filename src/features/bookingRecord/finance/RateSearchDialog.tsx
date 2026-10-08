import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import SeaPortSelect from '@/components/bookings/SeaPortSelect'
import { searchFclRates, type RateOption } from '@/pages/rates/rateSearchApi'
import { searchLclRates, type LclRateOption } from '@/pages/rates/lclRateSearchApi'
import type { FxRates } from '@/pages/rates/fx'
import { money } from '@/features/quoteBooking/quoteBookingApi'
import type { CostDraft, FinanceLane } from './bookingCostsApi'
import { fclOptionToLines, lclOptionToLines, legsForImport, type PreviewLine } from './costMapping'
import RatePreviewLines from './RatePreviewLines'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  lane: FinanceLane
  rates: FxRates
  autoPick: boolean
  onAdd: (drafts: CostDraft[]) => Promise<void>
}

type Opt = { key: string; vendor: string; logo: string | null; transit: number | null; validTo: string | null; freight: number; ccy: string; lines: PreviewLine[] }

const fmtContainers = (c: { size: string; qty: number }[]) => c.map((x) => `${x.qty}x${x.size}`).join(', ')
function parseContainers(s: string) {
  return s.split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
    const m = p.match(/^(\d+)\s*[xX×]\s*(\S+)$/)
    return m ? { qty: Number(m[1]), size: m[2].toUpperCase() } : { qty: 1, size: p.toUpperCase() }
  })
}

export default function RateSearchDialog({ open, onOpenChange, lane, rates, autoPick, onAdd }: Props) {
  const [mode, setMode] = useState<'FCL' | 'LCL'>(lane.loadType ?? 'FCL')
  const [from, setFrom] = useState(lane.origin ?? '')
  const [to, setTo] = useState(lane.destination ?? '')
  const [cont, setCont] = useState(fmtContainers(lane.containers))
  const [wm, setWm] = useState(String(lane.wm || ''))
  const [opts, setOpts] = useState<Opt[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)

  const run = useCallback(async (pick: boolean) => {
    if (!from || !to) { toast.error('Origin and destination needed'); return }
    setLoading(true); setSel(null)
    const legs = legsForImport(lane.incoterm)
    try {
      let next: Opt[]
      if (mode === 'FCL') {
        const containers = parseContainers(cont)
        const res: RateOption[] = await searchFclRates({ from_port_code: from, to_port_code: to, currency: null, movement: 'import', containers })
        next = res.map((o) => ({ key: o.cardId, vendor: o.carrierName, logo: null, transit: o.transitDays, validTo: o.validTo,
          freight: o.total, ccy: o.currency, lines: fclOptionToLines(o, containers, legs) }))
      } else {
        const w = Number(wm) || 0
        const res: LclRateOption[] = await searchLclRates({ from_port_code: from, to_port_code: to, currency: null, wm: w, cbm: lane.cbm || w, movement: 'import' })
        next = res.map((o) => ({ key: o.cardId, vendor: o.coLoaderName, logo: o.coLoaderLogo, transit: o.transitDays, validTo: o.validTo,
          freight: o.total, ccy: o.currency, lines: lclOptionToLines(o, legs) }))
      }
      setOpts(next); setSearched(true)
      if (pick && next.length > 0) setSel(0)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rate search failed')
    } finally { setLoading(false) }
  }, [from, to, mode, cont, wm, lane.incoterm, lane.cbm])

  useEffect(() => { if (open && autoPick) void run(true) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(key: string) {
    if (sel == null) return
    setOpts((prev) => prev.map((o, i) => i !== sel ? o : { ...o, lines: o.lines.map((l) => l.key === key ? { ...l, include: !l.include } : l) }))
  }

  async function add() {
    if (sel == null) return
    setBusy(true)
    try {
      const drafts = opts[sel].lines.filter((l) => l.include).map(({ key: _k, include: _i, ...d }) => d)
      await onAdd(drafts)
      onOpenChange(false)
    } finally { setBusy(false) }
  }

  const tab = (m: 'FCL' | 'LCL') => (
    <button className={`quotes-tabs__btn${mode === m ? ' quotes-tabs__btn--on' : ''}`} onClick={() => { setMode(m); setOpts([]); setSel(null) }}>{m}</button>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl" showCloseButton>
        <DialogHeader><DialogTitle>Search rate cards</DialogTitle></DialogHeader>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div className="quotes-tabs">{tab('FCL')}{tab('LCL')}</div>
          <div style={{ width: 200 }}><SeaPortSelect label="Origin" value={from} onChange={setFrom} placeholder="Origin port" /></div>
          <div style={{ width: 200 }}><SeaPortSelect label="Destination" value={to} onChange={setTo} placeholder="Dest port" /></div>
          {mode === 'FCL' ? (
            <input className="input input--sm" style={{ width: 170 }} value={cont} onChange={(e) => setCont(e.target.value)} placeholder="2x40HQ, 1x20GP" title="Containers" />
          ) : (
            <input className="input input--sm" style={{ width: 110 }} value={wm} onChange={(e) => setWm(e.target.value)} placeholder="W/M" title="Chargeable W/M" />
          )}
          <button className="btn btn--inline" title="Search" aria-label="Search" disabled={loading} onClick={() => void run(false)}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'auto', height: 32, padding: '0 12px' }}>
            <Search size={15} />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">Incoterm {lane.incoterm ?? 'unknown'} · import. Ticks default to the legs UBF pays.</p>

        <div className="table-wrap" style={{ maxHeight: 220, overflowY: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Vendor</th><th>Transit</th><th>Valid to</th><th style={{ textAlign: 'right' }}>Freight + surcharges</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="text-muted-foreground pad-inline">Searching…</td></tr>}
              {!loading && searched && opts.length === 0 && <tr><td colSpan={4} className="text-muted-foreground pad-inline">No rate cards for this lane. Add the cost manually.</td></tr>}
              {!loading && opts.map((o, i) => (
                <tr key={o.key} className="row-clickable" onClick={() => setSel(i)} style={sel === i ? { background: '#EFF6FF' } : undefined}>
                  <td>{o.logo ? <img src={o.logo} alt={o.vendor} title={o.vendor} style={{ height: 18 }} /> : o.vendor}</td>
                  <td>{o.transit != null ? `${o.transit}d` : '-'}</td>
                  <td>{o.validTo ?? '-'}</td>
                  <td style={{ textAlign: 'right' }}>{money(o.freight, o.ccy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sel != null && opts[sel] && (
          <RatePreviewLines lines={opts[sel].lines} rates={rates} busy={busy} onToggle={toggle} onAdd={() => void add()} />
        )}
      </DialogContent>
    </Dialog>
  )
}
