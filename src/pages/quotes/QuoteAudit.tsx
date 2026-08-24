import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { ChevronRight, ChevronLeft, ChevronDown } from 'lucide-react'
import { fetchAuditPage, buildEvents, type AuditEvent } from './auditApi'

const PAGE = 20
const label: CSSProperties = { fontSize: 12, color: 'var(--muted-foreground)' }
const ghost: CSSProperties = { marginTop: 0, width: 'auto', height: 28, padding: '0 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }
const DOT: Record<AuditEvent['kind'], string> = { create: '#12B76A', delete: '#F04438', status: '#0A2472', send: '#0A2472', update: '#98A2B3' }

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-NZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function QuoteAudit({ quoteId }: { quoteId: string }) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<Set<number>>(new Set())

  const load = useCallback(async (p: number) => {
    setLoading(true); setErr('')
    try {
      const { rows, total } = await fetchAuditPage(quoteId, p, PAGE)
      setEvents(buildEvents(rows)); setTotal(total)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed to load audit') }
    finally { setLoading(false) }
  }, [quoteId])

  useEffect(() => { load(page) }, [load, page])

  if (loading) return <p className="qr-placeholder">Loading history…</p>
  if (err) return <p className="qr-placeholder" style={{ color: '#B23B3B' }}>{err}</p>
  if (events.length === 0) return <p className="qr-placeholder">No changes recorded yet.</p>

  const pages = Math.max(1, Math.ceil(total / PAGE))
  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 820 }}>
      {events.map((e) => {
        const hasDetail = e.changes.length > 0
        const isOpen = open.has(e.id)
        return (
          <div key={e.id} style={{ borderBottom: '1px solid #F2F4F7' }}>
            <div onClick={hasDetail ? () => toggle(e.id) : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 2px', cursor: hasDetail ? 'pointer' : 'default' }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: DOT[e.kind], flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.summary}</span>
              <span style={{ ...label, whiteSpace: 'nowrap' }}>{e.actor}</span>
              <span style={{ ...label, whiteSpace: 'nowrap', minWidth: 92, textAlign: 'right' }}>{fmtTime(e.createdAt)}</span>
              <span style={{ width: 14, flexShrink: 0, color: '#98A2B3' }}>{hasDetail ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}</span>
            </div>
            {hasDetail && isOpen && (
              <div style={{ padding: '2px 0 8px 27px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {e.changes.map((c, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#475467' }}>
                    <span style={{ color: 'var(--muted-foreground)' }}>{c.label}: </span>
                    <span style={{ textDecoration: 'line-through', color: '#98A2B3' }}>{c.from}</span>
                    <span> → </span>
                    <span style={{ color: '#0A2472' }}>{c.to}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <span style={label}>Page {page + 1} of {pages}</span>
          <button className="btn btn--ghost btn--inline" style={ghost} disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft size={14} /> Prev</button>
          <button className="btn btn--ghost btn--inline" style={ghost} disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>Next <ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  )
}
