import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { useStaffList } from '@/hooks/useStaffList'
import { useStaffIdSet } from '@/hooks/useStaffIdSet'
import { EA_VIEWS, viewOf, type AirConsol, type EaView } from './eaTypes'
import EaBoardRow, { Cell, EA_COLS } from './EaBoardRow'
import { ConsolGroupHeader, LaneGroupHeader } from './EaGroupHeader'
import EaConsolDialog from './EaConsolDialog'
import { buildGroups } from './eaGroups'
import { btn, btnPrimary } from './eaUi'
import { allocateBookings, assignOwner, useEaBoard } from './useEaBoard'

type Dialog = { consol: AirConsol | null; dest?: string } | null

/** Export Air board: consol groups (starred first), then unallocated by lane. Collapsible, gridded, one next action per row. */
export default function EaBoardPage() {
  const navigate = useNavigate()
  const { rows, consols, loading, error, reload } = useEaBoard()
  const { staff } = useStaffList()
  const [stars, toggleStar] = useStaffIdSet('ea.consol.stars')
  const [collapsed, toggleCollapsed] = useStaffIdSet('ea.board.collapsed')
  const [view, setView] = useState<EaView>('open')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<Dialog>(null)

  const counts = useMemo(() => {
    const c: Record<EaView, number> = { open: 0, review: 0, pickup: 0, warehouse: 0, allocated: 0, departed: 0 }
    for (const r of rows) {
      const v = viewOf(r)
      c[v] += 1
      if (v !== 'departed') c.open += 1
    }
    return c
  }, [rows])

  const needle = q.trim().toLowerCase()
  const visible = useMemo(() => rows.filter((r) => {
    const v = viewOf(r)
    if (view === 'open' ? v === 'departed' : v !== view) return false
    if (!needle) return true
    return [r.booking_ref, r.shipper_name, r.shipper_code_name, r.consignee_name, r.consignee_code_name,
      r.consignee_account_id, r.shipper_account_id, r.consol_flight, r.quote_no]
      .some((s) => s?.toLowerCase().includes(needle))
  }), [rows, view, needle])

  const groups = useMemo(() => buildGroups(visible, consols, stars, view, !!needle), [visible, consols, stars, view, needle])

  const open = rows.filter((r) => viewOf(r) !== 'departed')
  const today = open.filter((r) => r.urgency === 'today' || r.urgency === 'blocked').length
  const late = open.filter((r) => r.urgency === 'overdue').length
  const nextCut = consols.filter((c) => c.cutoff_at && Date.parse(c.cutoff_at) > Date.now() && c.status !== 'exported')
    .sort((a, b) => Date.parse(a.cutoff_at!) - Date.parse(b.cutoff_at!))[0]
  const openConsols = consols.filter((c) => c.status !== 'exported')

  const ids = [...sel]
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allOn = visible.length > 0 && visible.every((r) => sel.has(r.id))

  async function run(fn: () => Promise<void>, ok: string) {
    try { await fn(); toast.success(ok); setSel(new Set()); await reload() } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="flex flex-col bg-white text-[12.5px] text-[#14161A]">
      <div className="mb-1.5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[18px] font-semibold tracking-[-0.015em]">Export air bookings</h1>
          <p className="m-0 mt-1 text-[12px] text-[#5B616E]">
            {open.length} open · <span className="font-medium text-[#14161A]">{today} need action today</span>
            {late ? <> · <span className="font-medium text-[#B42318]">{late} overdue</span></> : null}
            {nextCut ? <> · Next cutoff <span className="bk-mono text-[#14161A]">{nextCut.flight_no}</span> {format(parseISO(nextCut.cutoff_at!), 'EEE d MMM HH:mm')}</> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search bookings</span>
            <Search size={14} className="absolute left-2.5 top-2 text-[#98A2B3]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ref, shipper, consignee, code, flight"
              className="h-[30px] w-[260px] rounded-[7px] border border-[#E3E6EB] pl-[30px] pr-2.5 text-[12.5px] outline-none focus:border-[#0A2472]" />
          </label>
          <button type="button" className={btn} onClick={() => setDialog({ consol: null, dest: 'NAN' })}><Plus size={13} strokeWidth={2.2} /> Plan consol</button>
          <button type="button" className={btnPrimary} onClick={() => navigate('/bookings/export-air/new')}><Plus size={13} strokeWidth={2.2} /> New booking</button>
        </div>
      </div>

      <div role="tablist" aria-label="Views" className="flex flex-wrap border-b border-[#EEF0F3]">
        {EA_VIEWS.map((v) => {
          const on = v.id === view
          return (
            <button key={v.id} type="button" role="tab" aria-selected={on} onClick={() => { setView(v.id); setSel(new Set()) }}
              className={`mr-[18px] inline-flex w-auto items-center gap-1.5 border-0 border-b-2 bg-transparent px-0.5 py-2.5 text-[12.5px] ${on ? 'border-[#0A2472] font-semibold text-[#14161A]' : 'border-transparent text-[#5B616E] hover:text-[#14161A]'}`}>
              {v.label} <span className="bk-mono text-[10.5px] text-[#98A2B3]">{counts[v.id]}</span>
            </button>
          )
        })}
      </div>

      {sel.size > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-3.5 rounded-lg bg-[#0A2472] px-3 py-2 text-[12px] text-white">
          <b className="font-semibold">{sel.size} selected</b>
          <select aria-label="Allocate to consol" defaultValue="" className="h-[26px] rounded-md border-0 bg-white/15 px-2 text-[12px] text-white"
            onChange={(e) => { const v = e.target.value; if (v) void run(() => allocateBookings(ids, v === '-' ? null : v), v === '-' ? 'Unallocated' : 'Allocated'); e.target.value = '' }}>
            <option value="" className="text-black">Allocate to…</option>
            {openConsols.map((c) => <option key={c.id} value={c.id} className="text-black">{c.flight_no} · {c.destination} · {format(parseISO(c.flight_date), 'EEE d')}</option>)}
            <option value="-" className="text-black">Unallocate</option>
          </select>
          <select aria-label="Assign owner" defaultValue="" className="h-[26px] rounded-md border-0 bg-white/15 px-2 text-[12px] text-white"
            onChange={(e) => { const v = e.target.value; if (v) void run(() => assignOwner(ids, v), 'Owner set'); e.target.value = '' }}>
            <option value="" className="text-black">Assign owner…</option>
            {staff.map((s) => <option key={s.user_id} value={s.user_id} className="text-black">{s.name}</option>)}
          </select>
          <button type="button" onClick={() => setSel(new Set())} className="ml-auto w-auto border-0 bg-transparent text-[12px] text-white/80 hover:text-white">Clear</button>
        </div>
      ) : null}

      <div className="mt-2.5 overflow-x-auto rounded-[10px] border border-[#EEF0F3]">
        <div className="min-w-[1120px]">
          <div className={`${EA_COLS} bg-white text-[10.5px] uppercase tracking-[.04em] text-[#6B7280]`}>
            <Cell className="justify-center !py-2">
              <input type="checkbox" aria-label="Select all in view" checked={allOn} disabled={!visible.length}
                onChange={() => setSel(allOn ? new Set() : new Set(visible.map((r) => r.id)))} className="m-0 h-3.5 w-3.5 cursor-pointer accent-[#0A2472]" />
            </Cell>
            <Cell className="!py-2">Booking</Cell><Cell className="!py-2">Consignee · shipper</Cell>
            <Cell className="justify-end !py-2">Pcs · Kg · Chg</Cell><Cell className="!py-2">Ready</Cell>
            <Cell className="!py-2">Stage</Cell><Cell className="!py-2">Next action</Cell><Cell className="!py-2" />
          </div>
          {loading ? <div className="border-t border-[#EEF0F3] px-3 py-14 text-center text-[#6B7280]">Loading…</div> : null}
          {error ? <div className="border-t border-[#EEF0F3] px-3 py-4 text-[#B42318]">{error}</div> : null}
          {groups.map((g) => {
            const isOpen = !collapsed.has(g.key) || !!needle
            return (
              <div key={g.key}>
                {g.kind === 'consol' ? (
                  <ConsolGroupHeader c={g.consol} open={isOpen} starred={g.starred} shown={g.rows.length}
                    onToggle={() => toggleCollapsed(g.key)} onStar={() => toggleStar(g.consol.id)} onEdit={() => setDialog({ consol: g.consol })} />
                ) : (
                  <LaneGroupHeader dest={g.dest} count={g.rows.length} open={isOpen} onToggle={() => toggleCollapsed(g.key)}
                    onPlan={g.dest === 'UNSET' ? undefined : () => setDialog({ consol: null, dest: g.dest })} />
                )}
                {isOpen ? g.rows.map((r) => <EaBoardRow key={r.id} row={r} selected={sel.has(r.id)} onToggle={() => toggle(r.id)} />) : null}
                {isOpen && g.kind === 'consol' && g.rows.length === 0 ? (
                  <div className="border-t border-[#F1F2F5] px-12 py-2.5 text-[12px] text-[#98A2B3]">No houses yet. Tick bookings below and allocate.</div>
                ) : null}
              </div>
            )
          })}
          {!loading && !error && groups.length === 0 ? (
            <div className="border-t border-[#EEF0F3] px-3 py-14 text-center text-[#6B7280]">
              <div className="mb-1 font-medium text-[#14161A]">Nothing here</div>
              {view === 'departed' ? 'Bookings land here once TradeWindow sync confirms the flight left.' : 'No bookings match this view.'}
            </div>
          ) : null}
        </div>
      </div>

      {dialog ? <EaConsolDialog consol={dialog.consol} dest={dialog.dest} onClose={() => setDialog(null)} onSaved={() => void reload()} /> : null}
    </div>
  )
}
