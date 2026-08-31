import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, List, LayoutGrid, CalendarDays, Plane, Container, Boxes } from 'lucide-react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useSeaPorts } from '../../hooks/useSeaPorts'
import { useStaffList } from '../../hooks/useStaffList'
import { usePerm } from '../../access/PermissionsProvider'
import QuotesListView from './QuotesListView'
import QuotesKanban from './QuotesKanban'
import QuotesCalendar from './QuotesCalendar'

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

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <h1>Quotations</h1>
        </header>

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
                    style={{ lineHeight: 1, padding: '6px 12px', fontSize: 13, fontWeight: 500, gap: 5 }}
                    onClick={() => setMode(key)}
                  >
                    {Icon && <Icon size={14} strokeWidth={2} />} {label}
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
                  <Icon size={16} strokeWidth={2} />
                </button>
              ))}
            </div>
            {canAddQuote && (
              <button
                type="button"
                className="btn quotes-page__new-btn"
                onClick={() => navigate('/quotes/new')}
              >
                <Plus size={16} strokeWidth={2} />
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
          />
        )}
        {view === 'kanban' && (
          <QuotesKanban
            search={debouncedSearch}
            onOpen={openQuote}
            portName={portName}
            staffName={staffName}
          />
        )}
        {view === 'calendar' && (
          <QuotesCalendar search={debouncedSearch} onOpen={openQuote} />
        )}
      </div>
    </div>
  )
}
