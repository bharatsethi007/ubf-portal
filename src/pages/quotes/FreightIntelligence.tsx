import { useMemo, useState } from 'react'
import { Sparkles, X, RefreshCw, History } from 'lucide-react'
import { toast } from 'sonner'
import { incotermDescription } from './freightIntelligenceApi'
import { addChargesToQuote, type IntelQuery } from './intel/laneIntelApi'
import { checkCharges } from './intel/chargeMatch'
import { useLaneIntel, nzd } from './intel/useLaneIntel'
import IntelCharges from './intel/IntelCharges'
import { IntelKpis, IntelMargin } from './intel/IntelSummary'
import IntelHistory from './intel/IntelHistory'
import IntelDutyCheck from './intel/IntelDutyCheck'
import './intel/laneIntel.css'

type Props = {
  from: string | null
  to: string | null
  mode: 'air' | 'sea'
  direction: string | null
  incoterm: string | null
  loadType?: 'FCL' | 'LCL' | null
  quoteId?: string | null          // quote page: enables the charge check + add
  customerId?: string | null
  customerName?: string | null
  weightKg?: number | null
  volumeM3?: number | null
  onAddNote?: (line: string) => void
  onLinesChanged?: () => void      // remount the responses panel after we add lines
}

export default function FreightIntelligence(p: Props) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [months, setMonths] = useState(12)
  const laneReady = !!(p.from && p.to)

  const query = useMemo<IntelQuery | null>(() => (laneReady ? {
    from: p.from!, to: p.to!, mode: p.mode, direction: p.direction, loadType: p.mode === 'sea' ? p.loadType ?? null : null,
    customerId: p.customerId ?? null, weightKg: p.weightKg ?? null, volumeM3: p.volumeM3 ?? null, months,
  } : null), [laneReady, p.from, p.to, p.mode, p.direction, p.loadType, p.customerId, p.weightKg, p.volumeM3, months])

  const { intel, option, loading, error, reload, reloadOption } = useLaneIntel(query, p.quoteId ?? null, open)
  const checking = !!p.quoteId
  const rows = useMemo(() => checkCharges(intel?.charges ?? [], checking ? option?.lines ?? [] : null, intel?.customer?.codes ?? []),
    [intel, option, checking])
  const missing = checking ? rows.filter((r) => r.status === 'missing').length : 0

  if (!laneReady) return null

  function close() { setClosing(true); window.setTimeout(() => { setOpen(false); setClosing(false) }, 220) }

  async function add(codes: string[]) {
    if (!p.quoteId) return
    const picks = rows.filter((r) => codes.includes(r.code))
    try {
      await addChargesToQuote(p.quoteId, option, picks, p.direction)
      await reloadOption()
      p.onLinesChanged?.()
      const total = picks.reduce((s, c) => s + c.medSell, 0)
      toast.success(`Added ${picks.map((c) => c.code).join(', ')} at lane median (${nzd(total)}). Check buy rates.`)
      if (option && option.currency !== 'NZD') toast.warning(`Option is in ${option.currency}. Added lines are NZD, check ex rate.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add charges')
    }
  }

  if (!open) {
    return (
      <button type="button" className="fi-launch" onClick={() => setOpen(true)} aria-label="Freight Intelligence"
        title={missing ? `Freight Intelligence: ${missing} usual charge${missing === 1 ? '' : 's'} missing` : 'Freight Intelligence'}>
        <Sparkles size={22} />
        {missing > 0 && <><span className="fi-launch__ring" /><span className="fi-launch__badge">{missing}</span></>}
      </button>
    )
  }

  const incoDesc = incotermDescription(p.incoterm)
  const laneLine = [`${p.from} → ${p.to}`, p.mode === 'air' ? 'Air' : p.loadType ?? 'Sea', p.direction ? p.direction[0].toUpperCase() + p.direction.slice(1) : null, `${months} mo`]
    .filter(Boolean).join(' · ')

  return (
    <aside className={`fi-drawer${closing ? ' fi-drawer--out' : ''}`} aria-label="Freight Intelligence">
      <div className="fi-head">
        <Sparkles size={16} color="#0A2472" />
        <div style={{ minWidth: 0 }}>
          <div className="fi-head__title">Freight Intelligence</div>
          <div className="fi-head__lane">{laneLine}</div>
        </div>
        <button type="button" className={`fi-icon${loading ? ' fi-icon--spin' : ''}`} style={{ marginLeft: 'auto' }} title="Refresh" aria-label="Refresh" onClick={() => { void reload() }}>
          <RefreshCw size={15} />
        </button>
        <button type="button" className="fi-icon" title="Close" aria-label="Close" onClick={close}><X size={16} /></button>
      </div>

      <div className="fi-body">
        {loading && !intel && <div className="fi-sec">{[80, 60, 90, 70, 50].map((w, i) => <div key={i} className="fi-skel" style={{ width: `${w}%` }} />)}</div>}
        {error && <div className="fi-note">{error}</div>}

        {intel && intel.jobs === 0 && (
          <div className="fi-sec">
            <div style={{ fontSize: 13, color: '#111827' }}>No jobs on this lane in the last {months} months.</div>
            {months < 36 && (
              <button type="button" className="fi-icon" style={{ width: 'auto', padding: '0 8px', marginTop: 8, gap: 6, fontSize: 12 }}
                title="Look back 36 months" onClick={() => setMonths(36)}>
                <History size={14} /> Look back 3 years
              </button>
            )}
          </div>
        )}

        {intel && intel.jobs > 0 && (
          <>
            <IntelKpis intel={intel} />
            {checking && option && <IntelMargin intel={intel} option={option} />}
            {rows.length > 0 && <IntelCharges rows={rows} checking={checking} canAdd={checking} onAdd={add} />}
            <IntelHistory intel={intel} customerName={p.customerName ?? null} />
          </>
        )}

        {incoDesc && (
          <div className="fi-sec" style={{ animationDelay: '.28s' }}>
            <div className="fi-label">Incoterm · {(p.incoterm || '').toUpperCase()}</div>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: '#475064' }}>{incoDesc}</div>
          </div>
        )}
        <IntelDutyCheck onAddNote={p.onAddNote} />
      </div>

      <div className="fi-foot">From billed ERP jobs, NZD, GST/duty pass-throughs excluded. Medians per job. A guide, not a price.</div>
    </aside>
  )
}
