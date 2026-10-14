import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import '@/features/bookingsWorkspace/bookingsTheme.css'
import { ArrowLeft, Pencil } from 'lucide-react'
import { AirlineMark, Route } from './eaVisual'
import { awbOk, cargoOf, fmtAwb, fmtNum, type EaRow } from './eaTypes'
import { btn, btnPrimary, Card, eaHref, lbl, Tag } from './eaUi'
import { StatusCell } from './EaBoardRow'
import { statusFor } from './eaRowStatus'
import { allocateBookings } from './useEaBoard'
import { useEaConsol } from './useEaConsol'
import EaConsolDialog from './EaConsolDialog'
import EaMailBubble from './mail/EaMailBubble'
import EaConsolExport from './EaConsolExport'
import EaHawbDrawer from './EaHawbDrawer'

/** Consol planner: header, allocated houses, same-lane candidates, close + export to TradeWindow. */
export default function EaConsolPage() {
  const { consolId } = useParams()
  const navigate = useNavigate()
  const { consol: c, houses, subsOf, candidates, error, reload } = useEaConsol(consolId)
  const [editing, setEditing] = useState(false)
  const [hawb, setHawb] = useState<string | null>(null)

  if (error) return <div className="bk-root p-6 text-[#B42318]">{error}</div>
  if (!c) return <div className="bk-root p-6 text-[#6B7280]">Loading…</div>

  const locked = c.status === 'exported' || c.status === 'departed'
  const tot = houses.reduce((a, h) => { const x = cargoOf(h); return { pcs: a.pcs + Number(x.pcs ?? 0), kg: a.kg + Number(x.kg ?? 0), chg: a.chg + Number(x.chg ?? 0) } }, { pcs: 0, kg: 0, chg: 0 })

  async function move(ids: string[], to: string | null) {
    try { await allocateBookings(ids, to); await reload() } catch (e) { toast.error((e as Error).message) }
  }
  return (
    <div className="bk-root mx-auto w-full max-w-[1440px] bg-white text-[12.5px] text-[#14161A]">
      <nav aria-label="Back" className="mb-2 flex items-center gap-2 text-[12px] text-[#6B7280]">
        <button type="button" onClick={() => { const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0; if (idx > 0) navigate(-1); else navigate('/bookings/export-air') }}
          className="inline-flex h-[26px] w-auto items-center gap-1.5 rounded-md border border-[#E3E6EB] bg-white px-2 text-[12px] font-medium text-[#14161A] hover:bg-[#F6F7F9]"><ArrowLeft size={13} /> Back</button>
        <Link to="/bookings/export-air" className="text-[#6B7280] hover:underline">Export air</Link>
        <span>/</span><span>Consol <span className="bk-mono text-[#14161A]">{c.flight_no}</span></span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <AirlineMark flight={c.flight_no} name={c.airline} size={22} />
            <h1 className="bk-mono m-0 text-[19px] font-medium">{c.flight_no}</h1>
            <Tag tone={locked ? 'green' : c.status === 'planned' ? 'grey' : 'navy'}>{c.status}</Tag>
            <Tag><Route dest={c.destination} via={c.transit_port} /></Tag>
          </div>
          <div className="text-[12.5px] text-[#5B616E]">
            {format(parseISO(c.flight_date), 'EEEE d MMM')}{c.cutoff_at ? ` · cutoff ${format(parseISO(c.cutoff_at), 'EEE d MMM HH:mm')}` : ''} · consignee UBNAN
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-4 text-[12px] text-[#5B616E]">
            <span><b className="bk-mono font-medium text-[#14161A]">{houses.length}</b> houses</span>
            <span><b className="bk-mono font-medium text-[#14161A]">{fmtNum(tot.pcs)}</b> pcs</span>
            <span><b className="bk-mono font-medium text-[#14161A]">{fmtNum(tot.kg)}</b> kg</span>
            <span><b className="bk-mono font-medium text-[#14161A]">{fmtNum(tot.chg)}</b> chg</span>
          </div>
          <button type="button" className={btn} onClick={() => setEditing(true)}><Pencil size={13} /> {locked ? 'Details' : 'Edit details'}</button>
        </div>
      </div>

      <dl className="m-0 grid grid-cols-2 divide-x divide-[#F1F2F5] rounded-[10px] border border-[#EEF0F3] md:grid-cols-6">
        <Fact k="MAWB" v={c.mawb ? <span className="bk-mono" style={{ color: awbOk(c.mawb) ? undefined : '#B54708' }}>{fmtAwb(c.mawb)}</span> : <span className="text-[#B54708]">Not yet</span>} />
        <Fact k="Flight 1" v={<><span className="bk-mono">{c.flight_no}</span> · {format(parseISO(c.flight_date), 'EEE d MMM')}</>} />
        <Fact k="Transit · flight 2" v={c.transit_port || c.flight2_no ? <span className="bk-mono">{[c.transit_port, c.flight2_no].filter(Boolean).join(' · ')}{c.flight2_date ? ` · ${format(parseISO(c.flight2_date), 'd MMM')}` : ''}</span> : 'Direct'} />
        <Fact k="Cutoff" v={c.cutoff_at ? format(parseISO(c.cutoff_at), 'EEE d MMM HH:mm') : '—'} />
        <Fact k="ETA" v={c.eta_date ? format(parseISO(c.eta_date), 'EEE d MMM') : '—'} />
        <Fact k="Notes" v={c.notes || '—'} />
      </dl>

      <EaConsolExport consol={c} houses={houses} subsOf={subsOf} onDone={() => void reload()} />

      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[999_1_620px]">
          <Card title={`On this consol · ${houses.length}`}>
            <HouseList rows={houses} subsOf={subsOf} onOpen={setHawb} empty="Nothing allocated yet. Add from the right."
              action={locked ? undefined : { label: 'Remove', run: (id) => void move([id], null) }} />
          </Card>
        </div>
        <div className="min-w-0 flex-[1_1_420px]">
          <Card title={`Open on AKL → ${c.destination} · ${candidates.length}`}
            aside={!locked && candidates.some((r) => r.stage >= 2)
              ? <button type="button" className={btn} onClick={() => void move(candidates.filter((r) => r.stage >= 2).map((r) => r.id), c.id)}>Add all checked in</button>
              : null}>
            <HouseList rows={candidates} onOpen={setHawb} empty="No open bookings on this lane."
              action={locked ? undefined : { label: 'Add', run: (id) => void move([id], c.id), primary: true }} />
          </Card>
        </div>
      </div>
      <EaMailBubble onChanged={() => void reload()} />
      <EaHawbDrawer bookingId={hawb} onClose={() => setHawb(null)} onChanged={() => void reload()} />
      {editing ? <EaConsolDialog consol={c} onClose={() => setEditing(false)} onSaved={() => void reload()} /> : null}
    </div>
  )
}

function Fact({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-3.5 py-2.5">
      <dt className={lbl}>{k}</dt>
      <dd className="m-0 truncate text-[12.5px] text-[#14161A]">{v}</dd>
    </div>
  )
}

function HouseList({ rows, empty, action, onOpen, subsOf }: { rows: EaRow[]; empty: string; subsOf?: Map<string, EaRow[]>; onOpen?: (id: string) => void; action?: { label: string; run: (id: string) => void; primary?: boolean } }) {
  if (!rows.length) return <p className="m-0 px-4 py-4 text-[12px] text-[#6B7280]">{empty}</p>
  return (
    <ul className="m-0 list-none py-1">
      {rows.map((r) => {
        const x = cargoOf(r)
        return (
          <li key={r.id} className="grid grid-cols-[112px_minmax(0,1fr)_120px_190px_auto] items-center gap-3 border-t border-[#F6F7F9] px-4 py-2 first:border-t-0 hover:bg-[#F8F9FB]">
            <a href={eaHref(r.id)} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || !onOpen) return; e.preventDefault(); onOpen(r.id) }}
              className="bk-mono text-[12px] font-medium text-[#0A2472] hover:underline">{r.booking_ref}</a>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{r.consignee_code_name ?? r.consignee_name ?? '—'}</span>
              <span className="truncate text-[11px] text-[#6B7280]">
                {r.is_consolidation ? `Buyers consol · ${(subsOf?.get(r.id) ?? []).map((x) => x.shipper_code_name ?? x.shipper_name ?? x.booking_ref).join(', ') || 'no suppliers'}` : `from ${r.shipper_code_name ?? r.shipper_name ?? '—'}`}
              </span>
            </div>
            <span className="bk-mono text-right text-[11.5px]">{fmtNum(x.pcs)} · {fmtNum(x.kg)} · <b className="font-medium">{fmtNum(x.chg)}</b></span>
            <StatusCell s={statusFor(r, [], subsOf ?? new Map())} />
            {action ? (
              <button type="button" className={action.primary ? btnPrimary : btn} onClick={() => action.run(r.id)}>{action.label}</button>
            ) : <span />}
          </li>
        )
      })}
    </ul>
  )
}
