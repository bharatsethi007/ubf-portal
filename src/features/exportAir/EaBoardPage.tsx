import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { useStaffList } from '@/hooks/useStaffList'
import { useStaffIdSet } from '@/hooks/useStaffIdSet'
import { EA_VIEWS, viewOf, type AirConsol, type EaView } from './eaTypes'
import EaBoardRow, { EaColHeads } from './EaBoardRow'
import { ConsolGroupHeader } from './EaGroupHeader'
import EaUnallocPanel from './EaUnallocPanel'
import EaConsolDialog from './EaConsolDialog'
import { buildGroups, type EaGroup } from './eaGroups'
import { btn, btnPrimary } from './eaUi'
import { allocateBookings, setConsolOwner, useEaBoard } from './useEaBoard'
import { consolidate } from './eaMaster'
import { useEaDrag } from './useEaDrag'
import EaMailBubble from './mail/EaMailBubble'
import EaHawbDrawer from './EaHawbDrawer'

type Dialog = { consol: AirConsol | null; dest?: string } | null

/** Export Air board: consols on the left (starred first, own column heads), unallocated tray on the right. */
export default function EaBoardPage() {
  const navigate = useNavigate()
  const { rows, consols, loading, error, reload } = useEaBoard()
  const { staff } = useStaffList()
  const [stars, toggleStar] = useStaffIdSet('ea.consol.stars')
  const [collapsed, toggleCollapsed] = useStaffIdSet('ea.board.collapsed')
  const [panelPref, togglePanel] = useStaffIdSet('ea.board.panel')
  const [view, setView] = useState<EaView>('open')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<Dialog>(null)
  const [hawb, setHawb] = useState<string | null>(null)

  // Sub-HAWBs live under their master; the board lists masters and ordinary HAWBs.
  const subsOf = useMemo(() => {
    const m = new Map<string, typeof rows>()
    for (const r of rows) if (r.master_booking_id) m.set(r.master_booking_id, [...(m.get(r.master_booking_id) ?? []), r])
    return m
  }, [rows])
  const top = useMemo(() => rows.filter((r) => !r.master_booking_id), [rows])

  const counts = useMemo(() => {
    const c: Record<EaView, number> = { open: 0, review: 0, pickup: 0, warehouse: 0, allocated: 0, departed: 0 }
    for (const r of top) {
      const v = viewOf(r)
      c[v] += 1
      if (v !== 'departed') c.open += 1
    }
    return c
  }, [top])

  const needle = q.trim().toLowerCase()
  const visible = useMemo(() => top.filter((r) => {
    const v = viewOf(r)
    if (view === 'open' ? v === 'departed' : v !== view) return false
    if (!needle) return true
    const subs = subsOf.get(r.id) ?? []
    return [r, ...subs].some((x) => [x.booking_ref, x.shipper_name, x.shipper_code_name, x.consignee_name, x.consignee_code_name,
      x.consignee_account_id, x.shipper_account_id, x.consol_flight, x.quote_no].some((s) => s?.toLowerCase().includes(needle)))
  }), [top, subsOf, view, needle])

  const groups = useMemo(() => buildGroups(visible, consols, stars, view, !!needle), [visible, consols, stars, view, needle])
  const consolGroups = groups.filter((g): g is Extract<EaGroup, { kind: 'consol' }> => g.kind === 'consol')
  const lanes = groups.filter((g): g is Extract<EaGroup, { kind: 'lane' }> => g.kind === 'lane')
  // Tray opens itself when there is nothing on the left to look at.
  const [autoClosed, setAutoClosed] = useState(false)
  const panelOpen = panelPref.has('open') || (!autoClosed && consolGroups.length === 0 && lanes.length > 0)
  const togglePanelOpen = () => { if (panelOpen && !panelPref.has('open')) setAutoClosed(true); else { setAutoClosed(false); togglePanel('open') } }
  const dnd = useEaDrag(visible, sel, async () => { setSel(new Set()); await reload() })

  const open = top.filter((r) => viewOf(r) !== 'departed')
  const today = open.filter((r) => r.urgency === 'today' || r.urgency === 'blocked').length
  const late = open.filter((r) => r.urgency === 'overdue').length
  const nextCut = consols.filter((c) => c.cutoff_at && Date.parse(c.cutoff_at) > Date.now() && c.status !== 'exported')
    .sort((a, b) => Date.parse(a.cutoff_at!) - Date.parse(b.cutoff_at!))[0]
  const openConsols = consols.filter((c) => c.status !== 'exported')

  const ids = [...sel]
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  /** Tick HAWBs (optionally one master) and group them under a master. Opens the master. */
  async function consolidateSel() {
    const picked = top.filter((r) => sel.has(r.id))
    const masters = picked.filter((r) => r.is_consolidation)
    if (masters.length > 1) return toast.error('Pick one master at most. Its HAWBs stay, the others join it.')
    const children = picked.filter((r) => !r.is_consolidation).map((r) => r.id)
    try {
      const mid = await consolidate(children, masters[0]?.id ?? null)
      toast.success(masters[0] ? `${children.length} added to ${masters[0].booking_ref}` : `${children.length} HAWBs consolidated under a new master`)
      setSel(new Set()); await reload(); setHawb(mid)
    } catch (e) { toast.error((e as Error).message) }
  }

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
          <button type="button" disabled={sel.size < 2} onClick={() => void consolidateSel()}
            title={sel.size < 2 ? 'Tick two or more HAWBs going to the same buyer' : 'Group these HAWBs under one master HAWB'}
            className="inline-flex h-[26px] w-auto items-center gap-1.5 rounded-md border-0 bg-white/15 px-2.5 text-[12px] font-medium text-white hover:bg-white/25 disabled:opacity-50">
            <Layers size={13} /> Consolidate
          </button>
          <button type="button" onClick={() => setSel(new Set())} className="ml-auto w-auto border-0 bg-transparent text-[12px] text-white/80 hover:text-white">Clear</button>
        </div>
      ) : null}

      <div className="mt-2.5 flex items-start gap-3">
        <div className="min-w-0 flex-1 overflow-x-auto rounded-[10px] border border-[#EEF0F3]">
          <div className="min-w-[980px]">
            {loading ? <div className="px-3 py-14 text-center text-[#6B7280]">Loading…</div> : null}
            {error ? <div className="px-3 py-4 text-[#B42318]">{error}</div> : null}
            {consolGroups.map((g, gi) => {
              const isOpen = !collapsed.has(g.key) || !!needle
              const hot = dnd.over === g.key
              const dropOk = dnd.dragIds.length > 0 && dnd.canDrop(g)
              const allOn = g.rows.length > 0 && g.rows.every((r) => sel.has(r.id))
              return (
                <div key={g.key} {...dnd.target(g)}
                  className={`relative transition-[box-shadow,background-color] ${gi ? 'border-t-[6px] border-[#F4F5F7]' : ''} ${hot ? 'bg-[#F3F6FD] shadow-[inset_0_0_0_2px_#0A2472]' : dropOk ? 'shadow-[inset_0_0_0_1px_#C9D4EA]' : ''}`}>
                  {hot ? <div className="pointer-events-none absolute right-3 top-2 z-10 rounded-md bg-[#0A2472] px-2 py-0.5 text-[11px] font-medium text-white shadow">Drop on {g.consol.flight_no}</div> : null}
                  <ConsolGroupHeader c={g.consol} open={isOpen} starred={g.starred} shown={g.rows.length} staff={staff}
                    onToggle={() => toggleCollapsed(g.key)} onStar={() => toggleStar(g.consol.id)} onEdit={() => setDialog({ consol: g.consol })}
                    onOwner={(id) => void run(() => setConsolOwner(g.consol.id, id), id ? 'Consol owner set' : 'Consol unassigned')} />
                  {isOpen && g.rows.length ? (
                    <EaColHeads checked={allOn} onToggleAll={() => setSel((s) => {
                      const n = new Set(s)
                      for (const r of g.rows) { if (allOn) n.delete(r.id); else n.add(r.id) }
                      return n
                    })} />
                  ) : null}
                  {isOpen ? g.rows.map((r) => (
                    <div key={r.id}>
                      <EaBoardRow row={r} consols={consols} selected={sel.has(r.id)} onToggle={() => toggle(r.id)} onOpen={setHawb} subs={subsOf.get(r.id)}
                        drag={{ onStart: dnd.start(r), onEnd: dnd.end, dragging: dnd.dragIds.includes(r.id), locked: r.consol_status === 'exported' || r.consol_status === 'departed' }} />
                      {r.is_consolidation ? (subsOf.get(r.id) ?? []).map((sub) => (
                        <EaBoardRow key={sub.id} row={sub} consols={consols} selected={false} onToggle={() => undefined} onOpen={setHawb} nested />
                      )) : null}
                    </div>
                  )) : null}
                  {isOpen && g.rows.length === 0 ? (
                    <div className="border-t border-[#F1F2F5] px-12 py-2.5 text-[12px] text-[#98A2B3]">No houses yet. Drag bookings here from Unallocated.</div>
                  ) : null}
                </div>
              )
            })}
            {!loading && !error && consolGroups.length === 0 ? (
              <div className="px-3 py-14 text-center text-[#6B7280]">
                <div className="mb-1 font-medium text-[#14161A]">No consols in this view</div>
                {view === 'departed' ? 'Bookings land here once TradeWindow sync confirms the flight left.'
                  : lanes.length ? 'Bookings waiting for a consol are on the right.' : 'No bookings match this view.'}
              </div>
            ) : null}
          </div>
        </div>
        <EaUnallocPanel lanes={lanes} consols={consols} subsOf={subsOf} open={panelOpen} onToggle={togglePanelOpen}
          collapsed={collapsed} onToggleLane={toggleCollapsed} searching={!!needle} dnd={dnd} onOpen={setHawb}
          onPlan={(dest) => setDialog({ consol: null, dest })} />
      </div>

      <EaMailBubble onChanged={() => void reload()} />
      <EaHawbDrawer bookingId={hawb} onClose={() => setHawb(null)} onChanged={() => void reload()} />
      {dialog ? <EaConsolDialog consol={dialog.consol} dest={dialog.dest} onClose={() => setDialog(null)} onSaved={() => void reload()} /> : null}
    </div>
  )
}
