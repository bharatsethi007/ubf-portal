import { useMemo, useState } from 'react'
import { Sparkles, X, RefreshCw, History } from 'lucide-react'
import { toast } from 'sonner'
import { addChargesToQuote, addLinesToQuote, type IntelQuery } from './intel/laneIntelApi'
import { checkCharges } from './intel/chargeMatch'
import { useLaneIntel, nzd } from './intel/useLaneIntel'
import IntelCharges from './intel/IntelCharges'
import { IntelKpis, IntelMargin } from './intel/IntelSummary'
import IntelHistory from './intel/IntelHistory'
import IntelDutyCheck from './intel/IntelDutyCheck'
import IntelScope from './intel/IntelScope'
import IntelRates from './intel/IntelRates'
import IntelSignals from './intel/IntelSignals'
import IntelSailings from './intel/IntelSailings'
import { buildChecks, legsView } from './intel/quoteChecks'
import { buildSignals } from './intel/signals'
import IntelCartage from './intel/IntelCartage'
import { useCartageSuggest } from './intel/useCartageSuggest'
import type { FclUnit } from './intel/cartageSuggest'
import { cartageResponseLines } from './rateOptionCartage'
import type { QuoteFacts } from './intel/factsApi'
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
  containers?: FclUnit[]           // FCL groups, for cartage pricing
  onAddNote?: (line: string) => void
  onLinesChanged?: () => void      // remount the responses panel after we add lines
}

const EMPTY_FACTS: QuoteFacts = {
  incoterms: null, movement_type: null, service_type: null, agent_id: null, freight_terms: null,
  pickup_address: null, pickup_postal_code: null, pickup_location: null, drop_address: null, drop_postal_code: null, drop_location: null,
  shipper: null, consignee: null, need_insurance: false, cargo_value: null, is_hazardous: false, dg_un_number: null, dg_class: null,
  need_refrigeration: false, reefer_temp_c: null,
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

  const kind = p.mode === 'air' ? 'air' : p.loadType === 'LCL' ? 'lcl' : 'fcl'
  const { intel, rates, otherRates, sailings, credit, option, facts, loading, error, reload, reloadOption } = useLaneIntel(query, p.quoteId ?? null, open, laneReady ? kind : null)
  const checking = !!p.quoteId
  const rows = useMemo(() => checkCharges(intel?.charges ?? [], checking ? option?.lines ?? [] : null, intel?.customer?.codes ?? []),
    [intel, option, checking])

  // Live props win over the last saved quote row (autosave lags a few seconds).
  const merged = useMemo<QuoteFacts>(() => ({
    ...(facts ?? EMPTY_FACTS), incoterms: p.incoterm ?? facts?.incoterms ?? null, movement_type: p.direction ?? facts?.movement_type ?? null,
  }), [facts, p.incoterm, p.direction])
  const scope = useMemo(() => legsView(merged, checking ? option?.lines ?? [] : null).view, [merged, option, checking])
  const checks = useMemo(() => {
    const all = buildChecks(merged, checking ? option?.lines ?? null : null)
    return checking ? all : all.filter((c) => ['inco', 'mv', 'nolegs', 'ddp'].includes(c.id))
  }, [merged, option, checking])
  const signals = useMemo(() => buildSignals({
    kind, option: checking ? option : null, rates, otherRates, credit, customerName: p.customerName ?? null,
    checks, cbm: p.volumeM3 ?? null, kg: p.weightKg ?? null,
  }), [kind, checking, option, rates, otherRates, credit, p.customerName, checks, p.volumeM3, p.weightKg])
  const cartLeg = (merged.movement_type ?? '').toLowerCase() === 'export' ? 'origin' : 'dest'
  const cartage = useCartageSuggest(checking && option && facts && laneReady ? {
    kind, from: p.from!, to: p.to!, facts: merged, legBilled: !!scope.find((l) => l.key === cartLeg)?.billed || !scope.some((l) => l.payer),
    lines: option.lines, kg: p.weightKg ?? null, cbm: p.volumeM3 ?? null, fcl: p.containers ?? [],
  } : null)
  const likelyMissing = checking ? rows.filter((r) => r.status === 'missing' && (r.pct >= 60 || (r.onCustomer && r.pct >= 30))).length : 0
  const missing = likelyMissing + signals.filter((x) => x.level === 'warn').length + (cartage?.status === 'ok' ? 1 : 0)

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

  async function addCartage() {
    if (!p.quoteId || cartage?.status !== 'ok') return
    try {
      await addLinesToQuote(p.quoteId, option, cartageResponseLines(cartage.cartage))
      await reloadOption()
      p.onLinesChanged?.()
      toast.success(`Added cartage $${Math.round(cartage.cartage.amount).toLocaleString()} (${cartage.cartage.carrier ?? 'UBF'}).`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add cartage')
    }
  }

  if (!open) {
    return (
      <button type="button" className="fi-launch" onClick={() => setOpen(true)} aria-label="Freight Intelligence"
        title={missing ? `Freight Intelligence: ${missing} item${missing === 1 ? '' : 's'} to review` : 'Freight Intelligence'}>
        <Sparkles size={22} />
        {missing > 0 && <><span className="fi-launch__ring" /><span className="fi-launch__badge">{missing}</span></>}
      </button>
    )
  }

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

        {cartage && <div className="fi-sec" style={{ paddingBottom: 0, borderBottom: 'none' }}><IntelCartage s={cartage} canAdd={checking} onAdd={addCartage} /></div>}
        <IntelSignals signals={signals} quiet={checking && !loading && cartage?.status !== 'ok'} />
        {intel && intel.jobs > 0 && checking && option && <IntelMargin intel={intel} option={option} />}
        {intel && intel.jobs > 0 && rows.length > 0 && <IntelCharges rows={rows} checking={checking} onAdd={add} />}
        <IntelScope incoterm={merged.incoterms} movement={merged.movement_type} legs={scope} />
        {rates && <IntelRates rs={rates} />}
        {sailings && <IntelSailings s={sailings} />}
        {intel && intel.jobs > 0 && <IntelKpis intel={intel} />}
        {intel && intel.jobs > 0 && <IntelHistory intel={intel} customerName={p.customerName ?? null} />}
        <IntelDutyCheck onAddNote={p.onAddNote} />
      </div>

      <div className="fi-foot">Medians from billed ERP jobs, NZD. A guide, not a price.</div>
    </aside>
  )
}
