import { useState } from 'react'
import { Check, Plus, ListPlus } from 'lucide-react'
import { FreqBar } from './IntelMotion'
import type { CheckedCharge } from './chargeMatch'
import { nzd } from './useLaneIntel'

type Props = {
  rows: CheckedCharge[]
  checking: boolean             // quote page with an option: show status + add
  canAdd: boolean
  onAdd: (codes: string[]) => Promise<void>
}

const tone = (p: number) => (p >= 80 ? '#1F8A4C' : p >= 50 ? '#B4791F' : '#9aa3b2')

export default function IntelCharges({ rows, checking, canAdd, onAdd }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [just, setJust] = useState<Set<string>>(new Set())
  const missing = rows.filter((r) => r.status === 'missing')
  const expected = rows.filter((r) => r.status !== 'optional')
  const covered = expected.filter((r) => r.status === 'covered').length

  async function add(codes: string[]) {
    setBusy(codes.join(','))
    try {
      await onAdd(codes)
      setJust(new Set(codes))
      window.setTimeout(() => setJust(new Set()), 1600)
    } finally { setBusy(null) }
  }

  return (
    <div className="fi-sec" style={{ animationDelay: '.12s' }}>
      <div className="fi-label">
        Charges on this lane
        {checking && missing.length > 0 && canAdd && (
          <button type="button" className="fi-addall" title={`Add all ${missing.length} missing at lane median`}
            aria-label="Add all missing charges" disabled={!!busy} onClick={() => add(missing.map((m) => m.code))}>
            <ListPlus size={15} />
          </button>
        )}
        <span className="fi-label__aside">median sell / job</span>
      </div>

      {checking && expected.length > 0 && (
        <div className="fi-progress">
          <span>{covered} of {expected.length} usual charges on quote</span>
          <span className="fi-progress__bar"><span className="fi-progress__fill" style={{ width: `${(covered / expected.length) * 100}%` }} /></span>
        </div>
      )}

      {rows.map((r, i) => (
        <div key={r.code} className={`fi-row${checking ? '' : ' fi-row--nocheck'}${just.has(r.code) ? ' fi-row--just' : ''}`}
          style={{ animationDelay: `${0.15 + i * 0.035}s` }}>
          {checking && (
            <span className={`fi-st fi-st--${r.status}`} title={r.status === 'covered' ? 'On quote' : r.status === 'missing' ? 'Usually billed, not on quote' : 'Sometimes billed'}>
              {r.status === 'covered' && <Check size={11} strokeWidth={3} />}
            </span>
          )}
          <span className="fi-row__code">{r.code}</span>
          <span className="fi-row__desc" title={r.erpDescription ?? r.description}>
            {r.description}{r.onCustomer && <span className="fi-row__tag" title="Billed to this customer before">cust</span>}
          </span>
          <FreqBar pct={r.pct} tone={tone(r.pct)} delay={150 + i * 35} />
          <span className="fi-row__amt" title={`p25 ${nzd(r.p25Sell)} · p75 ${nzd(r.p75Sell)} · cost ${nzd(r.medCost)}`}>{nzd(r.medSell)}</span>
          {checking && (r.status !== 'covered' && canAdd ? (
            <button type="button" className="fi-add" title={`Add ${r.code} at ${nzd(r.medSell)}`} aria-label={`Add ${r.code}`}
              disabled={!!busy} onClick={() => add([r.code])}>
              <Plus size={14} />
            </button>
          ) : <span />)}
        </div>
      ))}

      <div className="fi-muted" style={{ marginTop: 8, display: 'flex', gap: 12 }}>
        <span><b style={{ color: '#1F8A4C' }}>■</b> 80%+ jobs</span>
        <span><b style={{ color: '#B4791F' }}>■</b> 50 to 79%</span>
        <span><b style={{ color: '#9aa3b2' }}>■</b> under 50%</span>
      </div>
    </div>
  )
}
