import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { setQuoteStatus } from './quotesApi'
import { listBoardQuotes, type BoardQuote } from './quotesBoardApi'
import { BOARD_COLUMNS, STATUS_ACCENT, CARD_STATUS_OPTIONS, modeTag } from './quoteCardMeta'

type Props = {
  search: string
  onOpen: (id: string) => void
  portName: (code: string | null) => string
  staffName: (id: string | null) => string
}

function fmtDay(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' })
}

export default function QuotesKanban({ search, onOpen, portName, staffName }: Props) {
  const [rows, setRows] = useState<BoardQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const reqId = useRef(0)

  useEffect(() => {
    const my = ++reqId.current
    setLoading(true)
    listBoardQuotes(search)
      .then((data) => {
        if (my !== reqId.current) return
        setRows(data)
        setError('')
      })
      .catch((e) => {
        if (my !== reqId.current) return
        setError(e instanceof Error ? e.message : 'Failed to load quotes')
        setRows([])
      })
      .finally(() => {
        if (my === reqId.current) setLoading(false)
      })
  }, [search])

  const byStatus = useMemo(() => {
    const m = new Map<string, BoardQuote[]>()
    for (const c of BOARD_COLUMNS) m.set(c.key, [])
    for (const r of rows) {
      const bucket = m.get(r.status)
      if (bucket) bucket.push(r)
      else m.set(r.status, [r]) // tolerate any unexpected status
    }
    return m
  }, [rows])

  async function move(id: string, to: string) {
    const current = rows.find((r) => r.id === id)
    if (!current || current.status === to) return
    const from = current.status
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: to } : r)))
    try {
      await setQuoteStatus(id, to)
    } catch (e) {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: from } : r)))
      toast.error(e instanceof Error ? e.message : 'Could not change status')
    }
  }

  if (error) return <div className="error">{error}</div>

  return (
    <div className="qboard" role="list">
      {BOARD_COLUMNS.map((col) => {
        const items = byStatus.get(col.key) ?? []
        return (
          <section
            key={col.key}
            className={`qboard__col${overCol === col.key ? ' qboard__col--over' : ''}`}
            style={{ ['--col-accent' as string]: STATUS_ACCENT[col.key] ?? '#64748B' }}
            onDragOver={(e) => {
              if (dragId) {
                e.preventDefault()
                setOverCol(col.key)
              }
            }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={(e) => {
              e.preventDefault()
              setOverCol(null)
              if (dragId) move(dragId, col.key)
              setDragId(null)
            }}
          >
            <header className="qboard__col-head">
              <span className="qboard__col-title">{col.label}</span>
              <span className="qboard__col-count">{items.length}</span>
            </header>

            <div className="qboard__col-body">
              {loading && items.length === 0 ? (
                <div className="qboard__skeleton" />
              ) : items.length === 0 ? (
                <p className="qboard__empty">No quotes</p>
              ) : (
                items.map((q) => {
                  const { label: modeLabel, Icon } = modeTag(q.shipment_mode, q.shipment_type)
                  return (
                    <article
                      key={q.id}
                      className={`qboard__card${dragId === q.id ? ' qboard__card--dragging' : ''}`}
                      draggable
                      onDragStart={() => setDragId(q.id)}
                      onDragEnd={() => {
                        setDragId(null)
                        setOverCol(null)
                      }}
                      onClick={() => onOpen(q.id)}
                    >
                      <div className="qboard__card-top">
                        <span className="qboard__card-ref">{q.quote_no ?? '—'}</span>
                        <span className="qboard__card-mode">
                          <Icon size={13} /> {modeLabel}
                        </span>
                      </div>
                      <div className="qboard__card-cust">{q.customer_name ?? '—'}</div>
                      <div className="qboard__card-lane">
                        <span>{portName(q.from_port_code)}</span>
                        <span className="qboard__card-arrow">→</span>
                        <span>{portName(q.to_port_code)}</span>
                      </div>
                      <div className="qboard__card-foot">
                        <span>{staffName(q.created_by)}</span>
                        <span>{fmtDay(q.created_at)}</span>
                      </div>
                      <select
                        className="qboard__card-status"
                        value={q.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => move(q.id, e.target.value)}
                      >
                        {CARD_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </article>
                  )
                })
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
