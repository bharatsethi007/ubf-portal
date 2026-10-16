import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, List, LayoutGrid, CalendarDays, Plane, Container, Boxes } from 'lucide-react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useSeaPorts } from '../../hooks/useSeaPorts'
import { usePorts } from '../../hooks/usePorts'
import { resolvePortLabel } from '../../features/portal/dashboard/portalPortDisplay'
import { useStaffList } from '../../hooks/useStaffList'
import { usePerm } from '../../access/PermissionsProvider'
import QuotesListView from './QuotesListView'
import QuotesKanban from './QuotesKanban'
import QuotesCalendar from './QuotesCalendar'
import QuotesStatsStrip from './QuotesStatsStrip'
import QuotesPortFilter from './QuotesPortFilter'
import QuoteMailBubble from './QuoteMailBubble'
import type { PortPair } from './quotesStatsApi'
import CustomerRatesTab from './rateCards/CustomerRatesTab'

type View = 'list' | 'kanban' | 'calendar'

const VIEWS: { key: View; label: string; Icon: typeof List }[] = [
  { key: 'list', label: 'List', Icon: List },
  { key: 'kanban', label: 'Board', Icon: LayoutGrid },
  { key: 'calendar', label: 'Calendar', Icon: CalendarDays },
]

type ModeFilter = 'all' | 'air' | 'fcl' | 'lcl'
const MODE_FILTERS: { key: ModeFilter; label: string; Icon: typeof List | null }[] = [
  { key: 'all', label: 'All', Icon: null },
  { key: 'air', label: 'Air', Icon: Plane },
  { key: 'fcl', label: 'FCL', Icon: Container },
  { key: 'lcl', label: 'LCL', Icon: Boxes },
]

export default function QuotesPage() {
  const navigate = useNavigate()
  const canAddQuote = usePerm('quotes', 'add')
  const { ports } = useSeaPorts()
  const { staff } = useStaffList()
  const { ports: allPorts } = usePorts()
  const [lane, setLane] = useState<PortPair>({ from: null, to: null })
  const [statsKey, setStatsKey] = useState(0)

  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'rates' ? 'rates' : 'quotes'
  const setTab = (t: 'quotes' | 'rates') => setParams(t === 'rates' ? { tab: 'rates' } : {}, { replace: true })
  const [view, setView] = useState<View>('list')
  const [mode, setMode] = useState<ModeFilter>('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  const portMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of ports) m.set(p.code, p.name)
    return m
  }, [ports])
  const staffMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of staff) m.set(s.user_id, s.name)
    return m
  }, [staff])

  const portName = (code: string | null) => (code ? portMap.get(code) ?? code : '—')
  const staffName = (id: string | null) => (id ? staffMap.get(id) ?? '—' : '—')
  const openQuote = (id: string) => navigate(`/quotes/${id}`)
  const laneName = (code: string) => resolvePortLabel(code, null, allPorts)

  return (
    <div className="quotes-page">
      <div className="mb-3 flex gap-6 border-b border-[#E6E8EE]" role="tablist" aria-label="Quotes area">
        {(['quotes', 'rates'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`-mb-px h-10 border-b-2 px-0.5 text-[13.5px] ${tab === t ? 'border-[#0A2472] text-[#0A2472]' : 'border-transparent text-[#5B6474]'}`}>
            {t === 'quotes' ? 'Quotes' : 'Customer rates'}
          </button>
        ))}
      </div>
      {tab === 'rates' ? (
        <div className="card quotes-page__card">
          <div className="quotes-page__toolbar">
            <label className="quotes-page__search">
              <Search size={16} strokeWidth={2} />
              <input className="input input--sm" placeholder="Search customer, ref, title" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
          <CustomerRatesTab search={debouncedSearch} />
        </div>
      ) : (
      <div className="card quotes-page__card">
        <QuotesStatsStrip title="Quotations" mode={view === 'list' ? mode : 'all'} lane={lane} refreshKey={statsKey} />

        <div className="quotes-page__toolbar">
          <label className="quotes-page__search">
            <Search size={16} strokeWidth={2} />
            <input
              className="input input--sm"
              placeholder="Search quote #, customer"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <QuotesPortFilter value={lane} onChange={setLane} portName={laneName} />

          <div className="quotes-page__actions">
            {view === 'list' && (
              <div className="quotes-viewtoggle" role="tablist" aria-label="Mode filter">
                {MODE_FILTERS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={mode === key}
                    title={label}
                    className={`quotes-viewtoggle__btn${mode === key ? ' quotes-viewtoggle__btn--on' : ''}`}
                    style={{ padding: '0 12px', fontWeight: 500, gap: 5 }}
                    onClick={() => setMode(key)}
                  >
                    {Icon && <Icon size={15} strokeWidth={2} />} {label}
                  </button>
                ))}
              </div>
            )}
            <div className="quotes-viewtoggle" role="tablist" aria-label="View">
              {VIEWS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={view === key}
                  title={label}
                  className={`quotes-viewtoggle__btn${view === key ? ' quotes-viewtoggle__btn--on' : ''}`}
                  onClick={() => setView(key)}
                >
                  <Icon size={15} strokeWidth={2} />
                </button>
              ))}
            </div>
            {canAddQuote && (
              <button
                type="button"
                className="btn quotes-page__new-btn"
                onClick={() => navigate('/quotes/new')}
              >
                <Plus size={15} strokeWidth={2} />
                New Quote
              </button>
            )}
          </div>
        </div>

        {view === 'list' && (
          <QuotesListView
            search={debouncedSearch}
            onOpen={openQuote}
            portMap={portMap}
            staffMap={staffMap}
            mode={mode}
            lane={lane}
            onChanged={() => setStatsKey((k) => k + 1)}
          />
        )}
        {view === 'kanban' && (
          <QuotesKanban
            search={debouncedSearch}
            lane={lane}
            onOpen={openQuote}
            portName={portName}
            staffName={staffName}
          />
        )}
        {view === 'calendar' && (
          <QuotesCalendar search={debouncedSearch} lane={lane} onOpen={openQuote} />
        )}
      </div>
      )}
      <QuoteMailBubble onChanged={() => setStatsKey((k) => k + 1)} />
    </div>
  )
}
