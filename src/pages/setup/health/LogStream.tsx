import { Fragment, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { fetchLogDetail, type LogRow, type Provider, sourceMeta } from './logsApi'

function stamp(iso: string) {
  const d = new Date(iso)
  const today = new Date().toLocaleDateString('en-NZ', { timeZone: 'Pacific/Auckland' })
  const day = d.toLocaleDateString('en-NZ', { timeZone: 'Pacific/Auckland' })
  const t = d.toLocaleTimeString('en-NZ', { timeZone: 'Pacific/Auckland', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const msPart = String(d.getMilliseconds()).padStart(3, '0')
  return day === today ? `${t}.${msPart}` : `${d.toLocaleDateString('en-NZ', { timeZone: 'Pacific/Auckland', day: '2-digit', month: 'short' })} ${t}`
}

/* Tiny JSON highlighter: keys violet, strings green, numbers blue, literals amber. */
function Json({ value }: { value: unknown }) {
  const raw = JSON.stringify(value, null, 2) ?? ''
  const html = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d+)?\b/g, (m, str, colon, lit) => {
      if (str) return colon ? `<span class="k">${str}</span>${colon}` : `<span class="s">${str}</span>`
      if (lit) return `<span class="b">${m}</span>`
      return `<span class="n">${m}</span>`
    })
  return <pre className="bs-json" dangerouslySetInnerHTML={{ __html: html }} />
}

const tryParse = (s: unknown) => {
  if (typeof s !== 'string') return null
  try { return JSON.parse(s) } catch { return null }
}

function Detail({ id }: { id: string }) {
  const [d, setD] = useState<Record<string, unknown> | null | undefined>(undefined)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { fetchLogDetail(id).then(setD).catch((e) => setErr(String(e.message ?? e))) }, [id])
  if (err) return <div className="bs-detail" style={{ color: 'var(--red)' }}>{err}</div>
  if (d === undefined) return <div className="bs-detail" style={{ color: 'var(--faint)' }}>Loading…</div>
  if (!d) return <div className="bs-detail" style={{ color: 'var(--faint)' }}>Row no longer kept.</div>

  const { req_body, res_body, log, return_message, ...rest } = d as Record<string, unknown>
  const scalars = Object.entries(rest).filter(([, v]) => v !== null && typeof v !== 'object')
  const objects = Object.entries(rest).filter(([, v]) => v !== null && typeof v === 'object')
  return (
    <div className="bs-detail">
      <dl className="bs-kv">
        {scalars.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{String(v)}</dd></Fragment>)}
      </dl>
      {objects.map(([k, v]) => <div key={k}><div className="bs-kv" style={{ marginTop: 10 }}><dt>{k}</dt></div><Json value={v} /></div>)}
      {req_body != null && <><div className="bs-kv" style={{ marginTop: 10 }}><dt>request</dt></div>
        {tryParse(req_body) ? <Json value={tryParse(req_body)} /> : <pre className="bs-json">{String(req_body)}</pre>}</>}
      {res_body != null && <><div className="bs-kv" style={{ marginTop: 10 }}><dt>response</dt></div>
        {tryParse(res_body) ? <Json value={tryParse(res_body)} /> : <pre className="bs-json">{String(res_body)}</pre>}</>}
      {return_message != null && <><div className="bs-kv" style={{ marginTop: 10 }}><dt>message</dt></div><pre className="bs-json">{String(return_message)}</pre></>}
      {log != null && <><div className="bs-kv" style={{ marginTop: 10 }}><dt>run log</dt></div><pre className="bs-json">{String(log)}</pre></>}
    </div>
  )
}

/* Message: split "METHOD /path  200  83ms" so the verb and status read separately. */
function Msg({ r }: { r: LogRow }) {
  const parts = r.message.split('  ')
  return (
    <span className="m" title={r.message}>
      {r.fn && <b>{r.fn} </b>}
      {parts.map((p, i) => <span key={i} style={i ? { marginLeft: 10, color: /^\d{3}$/.test(p) ? (Number(p) >= 400 ? 'var(--red)' : 'var(--green)') : undefined } : undefined}>{p}</span>)}
    </span>
  )
}

export default function LogStream({ rows, providers, fresh, loading, onMore, canMore }: {
  rows: LogRow[]; providers: Provider[]; fresh: Set<string>; loading: boolean; onMore: () => void; canMore: boolean
}) {
  const [open, setOpen] = useState<string | null>(null)
  if (!rows.length) {
    return <div className="bs-empty">{loading ? 'Loading…' : <><b>No events match</b>Widen the time range or clear filters.</>}</div>
  }
  return (
    <div className="bs-stream">
      {rows.map((r) => {
        const s = sourceMeta(r.source, providers)
        const isOpen = open === r.id
        return (
          <Fragment key={r.id}>
            <div className={`bs-line${isOpen ? ' open' : ''}${fresh.has(r.id) ? ' fresh' : ''}`} onClick={() => setOpen(isOpen ? null : r.id)}>
              <span className="chev">{isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
              <span className="t bs-num">{stamp(r.ts)}</span>
              <span className={`bs-lvl bs-lvl--${r.level}`}>{r.level.toUpperCase()}</span>
              <span className="bs-src" title={s.name}><i style={{ background: s.colour }} />{s.name}</span>
              <Msg r={r} />
            </div>
            {isOpen && <Detail id={r.id} />}
          </Fragment>
        )
      })}
      {canMore && (
        <div className="bs-more"><button type="button" className="bs-btn" onClick={onMore} disabled={loading}>{loading ? 'Loading…' : 'Load older'}</button></div>
      )}
    </div>
  )
}
