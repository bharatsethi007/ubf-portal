import { useState } from 'react'
import { Check, ChevronDown, Plus, ListPlus } from 'lucide-react'
import { FreqBar } from './IntelMotion'
import type { CheckedCharge } from './chargeMatch'
import { nzd } from './useLaneIntel'

type Props = { rows: CheckedCharge[]; checking: boolean; onAdd: (codes: string[]) => Promise<void> }

const tone = (p: number) => (p >= 80 ? '#1F8A4C' : p >= 50 ? '#B4791F' : '#9aa3b2')
// Only confident gaps are shown open: usual on the lane, or billed to this customer before.
const isLikely = (r: CheckedCharge) => r.status === 'missing' && (r.pct >= 60 || (r.onCustomer && r.pct >= 30))

export default function IntelCharges({ rows, checking, onAdd }: Props) {
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [just, setJust] = useState<Set<string>>(new Set())
  const likely = checking ? rows.filter(isLikely) : rows.filter((r) => r.pct >= 60).slice(0, 5)
  const rest = rows.filter((r) => !likely.includes(r))
  const covered = rows.filter((r) => r.status === 'covered').length

  async function add(codes: string[]) {
    setBusy(true)
    try { await onAdd(codes); setJust(new Set(codes)); window.setTimeout(() => setJust(new Set()), 1600) } finally { setBusy(false) }
  }

  const row = (r: CheckedCharge, i: number) => (
    <div key={r.code} className={`fi-row${checking ? '' : ' fi-row--nocheck'}${just.has(r.code) ? ' fi-row--just' : ''}`} style={{ animationDelay: `${0.1 + i * 0.04}s` }}>
      {checking && (
        <span className={`fi-st fi-st--${r.status}`} title={r.status === 'covered' ? 'On quote' : r.status === 'missing' ? 'Usually billed, not on quote' : 'Sometimes billed'}>
          {r.status === 'covered' && <Check size={11} strokeWidth={3} />}
        </span>
      )}
      <span className="fi-row__code">{r.code}</span>
      <span className="fi-row__desc" title={`${r.erpDescription ?? r.description} · on ${r.pct}% of jobs`}>
        {r.description}{r.onCustomer && <span className="fi-row__tag" title="Billed to this customer before">cust</span>}
      </span>
      <FreqBar pct={r.pct} tone={tone(r.pct)} delay={100 + i * 40} />
      <span className="fi-row__amt" title={`p25 ${nzd(r.p25Sell)} · p75 ${nzd(r.p75Sell)} · cost ${nzd(r.medCost)}`}>{nzd(r.medSell)}</span>
      {checking && (r.status !== 'covered'
        ? <button type="button" className="fi-add" title={`Add ${r.code} at ${nzd(r.medSell)}`} aria-label={`Add ${r.code}`} disabled={busy} onClick={() => add([r.code])}><Plus size={14} /></button>
        : <span />)}
    </div>
  )

  return (
    <div className="fi-sec" style={{ animationDelay: '.12s' }}>
      <div className="fi-label">
        {checking ? (likely.length ? 'Likely missing charges' : 'Charges') : 'Usual charges'}
        {checking && likely.length > 1 && (
          <button type="button" className="fi-addall" title={`Add all ${likely.length} at lane median`} aria-label="Add all likely missing" disabled={busy}
            onClick={() => add(likely.map((m) => m.code))}><ListPlus size={15} /></button>
        )}
        <span className="fi-label__aside">median sell / job</span>
      </div>

      {checking && !likely.length && (
        <div className="fi-check fi-check--ok" style={{ marginBottom: 6 }}>
          <Check size={14} color="#1F8A4C" /><div className="fi-check__t">All usual charges on quote ({covered} matched)</div>
        </div>
      )}
      {likely.map(row)}

      {rest.length > 0 && (
        <>
          <button type="button" className="fi-more" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide' : 'Show'} other lane charges ({rest.length})
            <ChevronDown size={13} style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
          </button>
          {open && <div style={{ animation: 'fi-rise .3s ease both' }}>{rest.map(row)}</div>}
        </>
      )}
    </div>
  )
}
