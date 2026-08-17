import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, List, LayoutGrid, CalendarDays } from 'lucide-react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useSeaPorts } from '../../hooks/useSeaPorts'
import { useStaffList } from '../../hooks/useStaffList'
import QuotesListView from './QuotesListView'
import QuotesKanban from './QuotesKanban'
import QuotesCalendar from './QuotesCalendar'

type View = 'list' | 'kanban' | 'calendar'

const VIEWS: { key: View; label: string; Icon: typeof List }[] = [
  { key: 'list', label: 'List', Icon: List },
  { key: 'kanban', label: 'Board', Icon: LayoutGrid },
  { key: 'calendar', label: 'Calendar', Icon: CalendarDays },
]

export default function QuotesPage() {
  const navigate = useNavigate()
  const { ports } = useSeaPorts()
  const { staff } = useStaffList()

  const [view, setView] = useState<View>('list')
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
            <button
              type="button"
              className="btn quotes-page__new-btn"
              onClick={() => navigate('/quotes/new')}
            >
              <Plus size={16} strokeWidth={2} />
              New Quote
            </button>
          </div>
        </div>

        {view === 'list' && (
          <QuotesListView
            search={debouncedSearch}
            onOpen={openQuote}
            portMap={portMap}
            staffMap={staffMap}
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
