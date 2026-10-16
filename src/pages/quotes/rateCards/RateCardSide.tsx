import { useState } from 'react'
import { GP_FLOOR, fmtDate, lineGp, viewStatus, type Line, type RateCard } from './rateCardModel'
import type { CardEvent, Watch } from './rateCardsApi'

type Props = {
  card: RateCard; lines: Line[]; watch: Map<string, Watch>; events: CardEvent[]; staffName: (id: string | null) => string
  canEdit: boolean; canApprove: boolean; busy: boolean
  onSubmit: (note: string) => void; onApprove: (comment: string, ack: boolean) => void; onChanges: (comment: string) => void
  onRevise: (renew: boolean) => void; onWithdraw: () => void
}

const EVENTS: Record<string, string> = {
  created: 'Draft created', saved: 'Draft saved', submitted: 'Sent for approval', changes_requested: 'Changes asked',
  published: 'Approved and published', withdrawn: 'Withdrawn', revised_from: 'New version', renewed_from: 'Renewal', copied_from: 'Copied from another rate card', from_setup: 'Made from Setup rate cards', pdf: 'PDF downloaded',
}
const kv = 'flex justify-between gap-3 border-t border-[#F0F1F4] py-[7px] text-[12.5px] first:border-t-0'
const when = (iso: string) => new Date(iso).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Summary, approval workflow and activity for one rate card. */
export default function RateCardSide(p: Props) {
  const { card: c, lines } = p
  const [note, setNote] = useState('')
  const [ack, setAck] = useState(false)
  const shown = lines.filter((l) => l.show)
  const gps = shown.map(lineGp).filter((g): g is number => g != null)
  const low = shown.filter((l) => { const g = lineGp(l); return g != null && g < GP_FLOOR })
  const lowest = shown.reduce<Line | null>((m, l) => { const g = lineGp(l); return g != null && (!m || g < (lineGp(m) ?? 999)) ? l : m }, null)
  const srcEnds = [...new Set([...p.watch.values()].map((w) => w.source_valid_to).filter((d): d is string => !!d && d < c.valid_to))].sort()
  const vs = viewStatus(c)
  const ta = 'input'; const taStyle = { height: 70, resize: 'none' as const, paddingTop: 8 }

  return (
    <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
      <section className="cp-card">
        <div className="cp-card-head"><h3 className="cp-card-title">Summary</h3></div>
        <div className="px-[18px] pb-3">
          <div className={kv}><span className="text-[#5B6474]">Lanes shown</span><span>{shown.length} of {lines.length}</span></div>
          <div className={kv}><span className="text-[#5B6474]">Average freight GP</span><span>{gps.length ? `${(gps.reduce((a, b) => a + b, 0) / gps.length).toFixed(1)}%` : '–'}</span></div>
          <div className={kv}><span className="text-[#5B6474]">Lowest lane GP</span>
            <span style={{ color: lowest && (lineGp(lowest) ?? 99) < GP_FLOOR ? '#B42318' : undefined }}>{lowest ? `${lineGp(lowest)}% · ${lowest.origin_code} > ${lowest.dest_code}${lowest.container_type ? ` ${lowest.container_type}` : ''}` : '–'}</span></div>
          <div className={kv}><span className="text-[#5B6474]">Carrier rates end before card</span><span style={{ color: srcEnds.length ? '#C4320A' : undefined }}>{srcEnds.length ? srcEnds.map((d) => fmtDate(d)).join(', ') : 'None'}</span></div>
        </div>
      </section>

      <section className="cp-card">
        <div className="cp-card-head"><h3 className="cp-card-title">Approval</h3></div>
        <div className="flex flex-col gap-2.5 px-[18px] pb-4 text-[12.5px]">
          {(c.status === 'draft' || c.status === 'changes') && (<>
            {c.status === 'changes' && c.approval_comment && <div className="rounded-lg bg-[#EFF4FF] px-3 py-2 text-[12px] text-[#1D4ED8]">Changes asked: {c.approval_comment}</div>}
            <span className="text-[#334155]">A pricing lead approves every rate card. It goes live on approval.</span>
            {low.length > 0 && <div className="rounded-lg bg-[#FEF3F2] px-3 py-2 text-[12px] text-[#B42318]">{low.length} lane{low.length > 1 ? 's' : ''} under the {GP_FLOOR}% GP floor. Approver must confirm.</div>}
            {p.canEdit && (<>
              <label className="flex flex-col gap-1"><span className="text-[11.5px] text-[#5B6474]">Note to approver</span>
                <textarea className={ta} style={taStyle} value={note} onChange={(e) => setNote(e.target.value)} /></label>
              <button type="button" className="btn quotes-page__new-btn justify-center" disabled={p.busy || !shown.length} onClick={() => p.onSubmit(note)}>Send for approval</button>
            </>)}
          </>)}
          {c.status === 'pending' && (<>
            <span className="text-[#334155]">Sent {c.submitted_at ? when(c.submitted_at) : ''}.</span>
            {c.approver_note && <div className="rounded-lg bg-[#F7F8FA] px-3 py-2 text-[12px] text-[#334155]">{c.approver_note}</div>}
            {p.canApprove ? (<>
              {low.length > 0 && <label className="flex items-start gap-2 text-[12.5px]"><input type="checkbox" className="mt-0.5" checked={ack} onChange={(e) => setAck(e.target.checked)} />I accept {low.length} lane{low.length > 1 ? 's' : ''} under {GP_FLOOR}% GP</label>}
              <label className="flex flex-col gap-1"><span className="text-[11.5px] text-[#5B6474]">Comment (shown to sales)</span>
                <textarea className={ta} style={taStyle} value={note} onChange={(e) => setNote(e.target.value)} /></label>
              <button type="button" className="btn justify-center !border-[#067647] !bg-[#067647] !text-white" disabled={p.busy || (low.length > 0 && !ack)} onClick={() => p.onApprove(note, ack)}>Approve and publish</button>
              <button type="button" className="btn btn--inline justify-center" disabled={p.busy} onClick={() => p.onChanges(note)}>Ask for changes</button>
            </>) : <span className="text-[#5B6474]">Waiting for a pricing lead.</span>}
          </>)}
          {['live', 'superseded', 'void'].includes(c.status) && (<>
            <span className="text-[#334155]">{c.status === 'live' ? 'Published' : c.status === 'superseded' ? 'Replaced by a newer version' : 'Withdrawn'}{c.approved_at ? ` · approved by ${p.staffName(c.approved_by)} ${fmtDate(c.approved_at)}` : ''}</span>
            {c.approval_comment && <div className="rounded-lg bg-[#F7F8FA] px-3 py-2 text-[12px] text-[#334155]">{c.approval_comment}</div>}
            <div className="flex gap-2">
              {p.canEdit && c.status === 'live' && vs !== 'expired' && <button type="button" className="btn btn--inline flex-1 justify-center" disabled={p.busy} onClick={() => p.onRevise(false)}>Revise</button>}
              {p.canEdit && <button type="button" className="btn btn--inline flex-1 justify-center" disabled={p.busy} onClick={() => p.onRevise(true)}>Renew</button>}
            </div>
            {p.canApprove && c.status === 'live' && vs !== 'expired' && <button type="button" className="btn btn--inline justify-center text-[#B42318]" disabled={p.busy} onClick={p.onWithdraw}>Withdraw</button>}
          </>)}
        </div>
      </section>

      {c.status !== 'live' && c.status !== 'superseded' && c.status !== 'void' && (
        <section className="cp-card">
          <div className="cp-card-head"><h3 className="cp-card-title">On publish</h3></div>
          <ol className="m-0 flex flex-col gap-1.5 py-1 pb-4 pl-[34px] pr-[18px] text-[12.5px] text-[#334155]">
            <li>Becomes {c.customer}'s contract rates from {fmtDate(c.valid_from)}</li>
            <li>Quotes and portal rate search use these sells</li>
            <li>Same lanes from older rates end the day before</li>
            <li>PDF ready to send from this page</li>
          </ol>
        </section>
      )}

      <section className="cp-card">
        <div className="cp-card-head"><h3 className="cp-card-title">Activity</h3></div>
        <ol className="m-0 flex list-none flex-col gap-2.5 px-[18px] pb-4">
          {p.events.length === 0 ? <li className="text-[12.5px] text-[#5B6474]">No activity yet.</li> : p.events.map((e) => (
            <li key={e.id} className="grid grid-cols-[10px_minmax(0,1fr)] gap-2.5 text-[12.5px]">
              <span className="mt-[5px] h-2 w-2 rounded-full bg-[#C7D0E6]" />
              <span className="flex flex-col"><span>{EVENTS[e.kind] ?? e.kind}</span>
                {typeof e.detail?.comment === 'string' && e.detail.comment && <span className="text-[12px] text-[#334155]">"{e.detail.comment}"</span>}
                <span className="text-[11.5px] text-[#5B6474]">{e.actor ?? 'System'} · {when(e.created_at)}</span></span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  )
}
