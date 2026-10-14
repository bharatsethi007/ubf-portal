import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { usePerm } from '../../access/PermissionsProvider'
import CodeMapPanel from './CodeMapPanel'
import EvidenceRow from './EvidenceRow'
import { LANES, describeEvidence, fetchLaneEvidence, type Evidence } from './evidenceApi'
import { money } from './sourceMeta'

const MONTHS = [3, 6, 12]

/**
 * What UBF actually billed on a lane (TradeWindow) against the charge sheet.
 * Shows only what needs a decision; everything else sits folded away.
 */
export default function LaneEvidence() {
  const canApprove = usePerm('brainbox', 'edit')
  const lane = LANES[0]
  const [product, setProduct] = useState<'consol' | 'direct'>('consol')
  const [months, setMonths] = useState(3)
  const [rows, setRows] = useState<Evidence[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [showOk, setShowOk] = useState(false)

  const load = useCallback(() => {
    setErr(null)
    fetchLaneEvidence(lane, months, product).then(setRows).catch((e: Error) => { setErr(e.message); setRows([]) })
  }, [lane, months, product])
  useEffect(() => { setRows(null); load() }, [load])

  const g = useMemo(() => {
    const r = rows ?? []
    const action = r.filter((e) => e.verdict === 'add' || e.verdict === 'update' || (e.verdict === 'agrees' && e.exceptions.length > 0))
    return {
      action,
      unmapped: r.filter((e) => e.verdict === 'unmapped' && e.jobs >= 10),
      agrees: r.filter((e) => e.verdict === 'agrees'),
      quiet: r.filter((e) => e.verdict === 'weak' || e.verdict === 'extra' || (e.verdict === 'unmapped' && e.jobs < 10)),
      jobs: r.reduce((m, e) => Math.max(m, e.jobs), 0),
      sheet: r.find((e) => e.sheet_title)?.sheet_title ?? null,
    }
  }, [rows])

  return (
    <section className="mt-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold">{lane.label}</div>
          <div className="text-xs text-[#6B7486]">
            What we billed in TradeWindow vs {g.sheet ? <b className="font-medium text-[#3D4757]">{g.sheet}</b> : 'the charge sheet'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#E6E9F0] bg-[#F7F8FC] p-0.5" role="group" aria-label="Product">
            {(['consol', 'direct'] as const).map((p) => (
              <button key={p} type="button" onClick={() => setProduct(p)} aria-pressed={product === p}
                className={`h-7 rounded-md px-3 text-xs ${product === p ? 'bg-white font-medium shadow-sm' : 'text-[#6B7486]'}`}>
                {p === 'consol' ? 'UBF consol' : 'Direct'}
              </button>
            ))}
          </div>
          <select className="input input--sm" style={{ width: 'auto' }} aria-label="Period" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {MONTHS.map((m) => <option key={m} value={m}>Last {m} months</option>)}
          </select>
        </div>
      </div>

      {err && <div className="rounded-lg border border-[#F3D9C4] bg-[#FFF8F2] px-4 py-3 text-sm text-[#8A4A17]">{err}</div>}
      {rows == null && <div className="text-sm text-[#6B7486]">Reading billing history…</div>}

      {rows != null && g.unmapped.length > 0 && (
        <div className="rounded-[10px] border border-[#E3E8FB] bg-[#F7F8FC]">
          <button type="button" onClick={() => setShowMap(!showMap)} aria-expanded={showMap}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-[13px]">
            <span><b className="font-medium">{g.unmapped.length} ERP codes need mapping</b> <span className="text-[#6B7486]">before they can be compared. One-off.</span></span>
            {showMap ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {showMap && <div className="px-4 pb-4"><CodeMapPanel rows={g.unmapped} sheetId={rows?.find((e) => e.sheet_id)?.sheet_id ?? null} sheetTitle={g.sheet} canEdit={canApprove} onSaved={load} /></div>}
        </div>
      )}

      {rows != null && (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] uppercase tracking-wider text-[#6B7486]">
            Needs a decision · {g.action.length}
          </div>
          {g.action.length === 0 && <div className="rounded-[10px] border border-dashed border-[#E6E9F0] px-4 py-6 text-center text-sm text-[#6B7486]">Nothing to change. Card matches what we bill.</div>}
          {g.action.map((e) => <EvidenceRow key={e.erp_code} e={e} lane={lane} canApprove={canApprove} onDone={load} />)}
        </div>
      )}

      {rows != null && (g.agrees.length > 0 || g.quiet.length > 0) && (
        <div className="rounded-[10px] border border-[#ECEEF4]">
          <button type="button" onClick={() => setShowOk(!showOk)} aria-expanded={showOk}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs text-[#6B7486]">
            <span>{g.agrees.length} match the card · {g.quiet.length} not enough evidence or extras</span>
            {showOk ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showOk && (
            <div className="border-t border-[#ECEEF4] px-4 py-2">
              {[...g.agrees, ...g.quiet].map((e) => (
                <div key={e.erp_code} className="flex justify-between gap-4 py-1 text-xs">
                  <span className="truncate">{e.label} <span className="text-[#8A93A5]">{e.erp_code}</span></span>
                  <span className="shrink-0 text-[#6B7486]">
                    {e.verdict === 'agrees' ? 'Matches card' : e.verdict === 'extra' ? 'Extra' : describeEvidence(e, money)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
