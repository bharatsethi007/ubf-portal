import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import DriverRail from './DriverRail'
import ConsignmentCard from './ConsignmentCard'
import ConsignmentDrawer from './ConsignmentDrawer'
import AssignConfirmDialog from './AssignConfirmDialog'
import {
  listDrivers, listDispatchConsignments, boardKpis, assignConsignment, unassignConsignment,
  DISPATCH_TABS, type DispatchTab, type DriverRow, type CardRow, type Kpis,
} from './dispatchApi'

const KPI_ITEMS: { key: keyof Kpis; label: string }[] = [
  { key: 'unassigned', label: 'Unassigned' }, { key: 'assigned', label: 'Assigned' },
  { key: 'inTransit', label: 'In Transit' }, { key: 'complete', label: 'Complete' },
  { key: 'incomplete', label: 'Incomplete' }, { key: 'total', label: 'Total' },
]

export default function DispatchBoard() {
  const [tab, setTab] = useState<DispatchTab>('assigned')
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [cards, setCards] = useState<CardRow[]>([])
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [pending, setPending] = useState<{ card: CardRow; driver: DriverRow } | null>(null)
  const [saving, setSaving] = useState(false)

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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Assign failed')
    } finally { setSaving(false) }
  }

  async function onUnassign(id: string) {
    try { await unassignConsignment(id); toast.success('Unassigned'); loadCards(); loadAux() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Unassign failed') }
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
          {DISPATCH_TABS.map(({ key, label }) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key}
              className={`quotes-tabs__btn${tab === key ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>

        <div className="mt-3 flex gap-3" style={{ minHeight: 420 }}>
          <DriverRail drivers={drivers} selectedId={selectedDriver} onSelect={setSelectedDriver} onDropCard={onDropCard} />
          <div className="flex-1 space-y-2 overflow-y-auto">
            {loading ? (
              <p className="py-6 text-sm text-neutral-400">Loading…</p>
            ) : shown.length === 0 ? (
              <p className="py-6 text-sm text-neutral-400">No consignments{selectedDriver ? ' for this driver' : ''} on this board.</p>
            ) : (
              shown.map((c) => <ConsignmentCard key={c.id} card={c} onOpen={() => setDrawerId(c.id)} onUnassign={onUnassign} />)
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-400">Drag a consignment onto a driver to assign. Hover a card to unassign.</p>
      </div>

      <ConsignmentDrawer id={drawerId} onClose={() => setDrawerId(null)} />
      <AssignConfirmDialog card={pending?.card ?? null} driver={pending?.driver ?? null} saving={saving} onCancel={() => setPending(null)} onConfirm={confirmAssign} />
    </div>
  )
}
