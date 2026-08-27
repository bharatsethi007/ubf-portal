import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { UserCheck, Inbox, AlertTriangle, CheckCircle2, type LucideIcon } from 'lucide-react'
import DriverRail from './DriverRail'
import ConsignmentCard from './ConsignmentCard'
import ConsignmentDrawer from './ConsignmentDrawer'
import AssignConfirmDialog from './AssignConfirmDialog'
import CompleteConfirmDialog from './CompleteConfirmDialog'
import TruckMap from './TruckMap'
import {
  listDrivers, listDispatchConsignments, boardKpis, assignConsignment, unassignConsignment,
  completeConsignment, assignConsignmentToDriver,
  DISPATCH_TABS, type DispatchTab, type DriverRow, type CardRow, type Kpis,
} from './dispatchApi'

const KPI_ITEMS: { key: keyof Kpis; label: string }[] = [
  { key: 'unassigned', label: 'Unassigned' }, { key: 'assigned', label: 'Assigned' },
  { key: 'inTransit', label: 'In Transit' }, { key: 'complete', label: 'Complete' },
  { key: 'incomplete', label: 'Incomplete' }, { key: 'total', label: 'Total' },
]

const TAB_ICON: Record<DispatchTab, LucideIcon> = {
  assigned: UserCheck, unassigned: Inbox, incomplete: AlertTriangle, completed: CheckCircle2,
}

export default function DispatchBoardView() {
  const [tab, setTab] = useState<DispatchTab>('assigned')
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [cards, setCards] = useState<CardRow[]>([])
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [pending, setPending] = useState<{ card: CardRow; driver: DriverRow } | null>(null)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState<CardRow | null>(null)
  const [completeSaving, setCompleteSaving] = useState(false)

  const loadCards = useCallback(() => {
    setLoading(true)
    listDispatchConsignments(tab).then(setCards).catch(() => setCards([])).finally(() => setLoading(false))
  }, [tab])
  const loadAux = useCallback(() => {
    listDrivers().then(setDrivers).catch(() => {})
    boardKpis().then(setKpis).catch(() => {})
  }, [])

  useEffect(() => { loadCards() }, [loadCards])
  useEffect(() => { loadAux() }, [loadAux])

  const shown = selectedDriver && tab === 'assigned' ? cards.filter((c) => c.assigned_driver_leg1 === selectedDriver) : cards
  const routeDriver = drivers.find((d) => d.id === selectedDriver)
  const routeDriverName = routeDriver ? `${routeDriver.first_name} ${routeDriver.last_name}` : null

  function onDropCard(driverId: string, cardId: string) {
    const card = cards.find((c) => c.id === cardId)
    const driver = drivers.find((d) => d.id === driverId)
    if (card && driver) setPending({ card, driver })
  }
  async function confirmAssign() {
    if (!pending) return
    setSaving(true)
    try {
      await assignConsignment(pending.card, pending.driver)
      toast.success(`${pending.card.consignment_no} assigned to ${pending.driver.first_name}`)
      setPending(null); loadCards(); loadAux()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Assign failed') } finally { setSaving(false) }
  }
  async function onUnassign(id: string) {
    try { await unassignConsignment(id); toast.success('Unassigned'); loadCards(); loadAux() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Unassign failed') }
  }
  function onComplete(id: string) { setCompleting(cards.find((c) => c.id === id) ?? null) }
  async function confirmComplete() {
    if (!completing) return
    setCompleteSaving(true)
    try {
      await completeConsignment(completing.id)
      toast.success(`${completing.consignment_no} marked complete`)
      setCompleting(null); loadCards(); loadAux()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Complete failed') } finally { setCompleteSaving(false) }
  }
  async function onAssignJob(consignmentId: string, driverId: string) {
    const driver = drivers.find((d) => d.id === driverId)
    if (!driver) return
    try {
      await assignConsignmentToDriver(consignmentId, driver)
      toast.success(`Assigned to ${driver.first_name}`)
      loadCards(); loadAux()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Assign failed') }
  }

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <div className="mb-3 flex flex-wrap gap-2">
          {KPI_ITEMS.map(({ key, label }) => (
            <span key={key} className="rounded-md bg-[#0A2472]/5 px-2.5 py-1 text-xs font-medium text-[#0A2472]">{label} {kpis ? kpis[key] : '—'}</span>
          ))}
        </div>
        <div className="quotes-tabs" role="tablist" aria-label="Dispatch board">
          {DISPATCH_TABS.map(({ key, label }) => {
            const Icon = TAB_ICON[key]
            return (
              <button key={key} type="button" role="tab" aria-selected={tab === key}
                className={`quotes-tabs__btn${tab === key ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab(key)}>
                <span className="inline-flex items-center gap-1.5"><Icon size={14} />{label}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3" style={{ minHeight: 620 }}>
          <DriverRail drivers={drivers} selectedId={selectedDriver} onSelect={setSelectedDriver} onDropCard={onDropCard} />
          <div className="w-full space-y-2 overflow-y-auto lg:w-[280px] lg:shrink-0" style={{ maxHeight: 620 }}>
            {loading ? <p className="py-6 text-sm text-neutral-400">Loading…</p>
             : shown.length === 0 ? <p className="py-6 text-sm text-neutral-400">No consignments{selectedDriver ? ' for this driver' : ''} on this board.</p>
             : shown.map((c) => <ConsignmentCard key={c.id} card={c} onOpen={() => setDrawerId(c.id)} onUnassign={onUnassign} onComplete={onComplete} />)}
          </div>
          <div className="min-w-0 flex-1 lg:min-w-[360px]">
            <TruckMap
              routeDriverId={selectedDriver}
              driverName={routeDriverName}
              drivers={drivers}
              onAssignJob={onAssignJob}
              onTruckClick={(reg) => {
                const norm = (s?: string | null) => (s ?? '').replace(/\s+/g, '').toUpperCase()
                const d = drivers.find((x) => norm(x.current_registration) === norm(reg))
                if (d) setSelectedDriver(d.id)
                else toast(`No driver assigned to ${reg}`)
              }}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-400">Drag a consignment onto a driver to assign, or tap a job on the map to assign it. Tap ✓ on a card to complete.</p>
      </div>
      <ConsignmentDrawer id={drawerId} onClose={() => setDrawerId(null)} />
      <AssignConfirmDialog card={pending?.card ?? null} driver={pending?.driver ?? null} saving={saving} onCancel={() => setPending(null)} onConfirm={confirmAssign} />
      <CompleteConfirmDialog card={completing} saving={completeSaving} onCancel={() => setCompleting(null)} onConfirm={confirmComplete} />
    </div>
  )
}
