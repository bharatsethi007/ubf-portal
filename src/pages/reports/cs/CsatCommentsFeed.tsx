import { type CSSProperties } from 'react'
import type { CsatCommentRow } from './csatApi'

function labelChannel(c: string | null): string {
  if (!c) return '—'
  return c.replace(/_/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase())
}

function scoreStyle(score: number | null, sentiment: string | null): CSSProperties {
  const s = (sentiment ?? '').toLowerCase()
  if (s === 'positive' || (score != null && score >= 4)) return { color: '#1F8A4C', fontWeight: 700 }
  if (s === 'negative' || (score != null && score <= 2)) return { color: '#B23B3B', fontWeight: 700 }
  if (s === 'neutral' || score === 3) return { color: '#B4791F', fontWeight: 600 }
  return { fontWeight: 600 }
}

function fmtDate(iso: string): string {
  return iso?.slice(0, 10) ?? '—'
}

type Props = { rows: CsatCommentRow[]; loading: boolean }

export default function CsatCommentsFeed({ rows, loading }: Props) {
  return (
    <div className="card quotes-page__card">
      <header className="quotes-page__head">
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Comments</h3>
      </header>
      {loading ? (
        <p className="text-muted-foreground" style={{ fontSize: 13, margin: 0, padding: '0 4px 8px' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground" style={{ fontSize: 13, margin: 0, padding: '0 4px 8px' }}>No comments for this period.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r, i) => (
            <li key={`${r.created_at}-${i}`} style={{ borderTop: i ? '1px solid var(--color-line)' : undefined, paddingTop: i ? 12 : 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
                <span className="text-muted-foreground">{fmtDate(r.created_at)}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4,
                  padding: '2px 8px', borderRadius: 999, background: 'rgba(10,36,114,0.08)', color: '#0A2472',
                }}>{labelChannel(r.channel)}</span>
                <span>{r.customer_name?.trim() || r.account_id || '—'}</span>
                {r.staff_initials && <span className="text-muted-foreground">· {r.staff_initials}</span>}
                <span style={scoreStyle(r.score, r.sentiment)}>
                  {r.score != null ? `${Number(r.score)}/5` : '—'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--color-ink)' }}>
                {r.comment?.trim() || <span className="text-muted-foreground">No comment text</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
