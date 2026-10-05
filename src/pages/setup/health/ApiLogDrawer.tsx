import { Fragment, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Download, X } from 'lucide-react'
import { Empty, Skeleton } from '../../tower/towerUi'
import { type ApiCall, type ApiRow, useHealthRpc } from './healthApi'
import { fmtBytes, ms, Mono, nzTime, StatusPill } from './healthUi'
import { apiTone } from './ApisTab'

function pretty(s: string | null): string {
  if (!s) return ''
  try { return JSON.stringify(JSON.parse(s), null, 2) } catch { return s }
}

function toCsv(rows: ApiCall[]): string {
  const cols: (keyof ApiCall)[] = ['at', 'fn', 'method', 'path', 'status', 'ok', 'ms', 'bytes_out', 'bytes_in', 'error']
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

export default function ApiLogDrawer({ api, onClose }: { api: ApiRow; onClose: () => void }) {
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const { data, loading, error } = useHealthRpc<ApiCall[]>(
    'system_api_log', { p_provider: api.code, p_errors_only: errorsOnly, p_limit: 200 }, 30_000)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const rows = data ?? []
  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${api.code}-calls.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="sh-drawer-bg" onClick={onClose} />
      <aside className="sh-drawer tw-root" role="dialog" aria-label={`${api.name} call log`} style={{ padding: 0, gap: 0 }}>
        <div className="sh-drawer__head">
          <div style={{ flex: 1 }}>
            <h2>{api.name}</h2>
            <div className="tw-stamp">{api.calls.toLocaleString()} calls · {api.errors} errors · p95 {ms(api.p95_ms)} · sent {fmtBytes(api.bytes_out)} · received {fmtBytes(api.bytes_in)}</div>
          </div>
          <StatusPill tone={apiTone(api)} />
          <button type="button" className="tw-ib" title="Close" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="sh-drawer__tools">
          <div className="sh-seg" role="group" aria-label="Filter">
            <button type="button" aria-pressed={!errorsOnly} onClick={() => setErrorsOnly(false)}>All calls</button>
            <button type="button" aria-pressed={errorsOnly} onClick={() => setErrorsOnly(true)}>Errors only</button>
          </div>
          <span className="tw-gap" />
          <button type="button" className="tw-ib tw-ib--sm" title="Export CSV" aria-label="Export CSV" onClick={download} disabled={!rows.length}>
            <Download size={15} />
          </button>
        </div>
        <div className="sh-drawer__body">
          {error && <Empty title="Could not load log">{error}</Empty>}
          {loading && !data && <div style={{ padding: 18, display: 'grid', gap: 10 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={22} />)}</div>}
          {!loading && !rows.length && !error && (
            <Empty title={errorsOnly ? 'No errors' : 'No calls logged yet'}>
              {errorsOnly ? 'Nothing failed in the retained window.' : 'Shows once this provider’s functions use apiFetch.'}
            </Empty>
          )}
          {!!rows.length && (
            <table className="tw-t sh-log">
              <thead><tr><th style={{ width: 28 }} /><th>Time</th><th>Function</th><th>Request</th><th className="r">Status</th><th className="r">Time</th><th className="r">Size</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const isOpen = openId === r.id
                  return (
                    <Fragment key={r.id}>
                      <tr className={isOpen ? 'sh-open' : ''} onClick={() => setOpenId(isOpen ? null : r.id)} style={{ animation: 'none' }}>
                        <td>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                        <td className="m tw-num">{nzTime(r.at)}</td>
                        <td className="ink">{r.fn ?? '—'}</td>
                        <td className="name" title={r.path ?? ''}><b style={{ fontWeight: 500 }}>{r.method}</b> {r.path}</td>
                        <td className="r"><span className={`tw-pill ${r.ok ? 'tw-pill--green' : 'tw-pill--red'}`}>{r.status ?? 'ERR'}</span></td>
                        <td className="r tw-num m">{ms(r.ms)}</td>
                        <td className="r tw-num m">{fmtBytes((r.bytes_out ?? 0) + (r.bytes_in ?? 0))}</td>
                      </tr>
                      {isOpen && (
                        <tr><td colSpan={7} style={{ padding: 0 }}>
                          <div className="sh-detail">
                            <div className="tw-stamp">{r.host} · sent {fmtBytes(r.bytes_out)} · received {fmtBytes(r.bytes_in)}</div>
                            {r.error && <><h4>Error</h4><Mono>{r.error}</Mono></>}
                            {r.req_body && <><h4>Request</h4><Mono>{pretty(r.req_body)}</Mono></>}
                            {r.res_body && <><h4>Response</h4><Mono>{pretty(r.res_body)}</Mono></>}
                            {!r.req_body && !r.res_body && !r.error && <div className="tw-stamp" style={{ marginTop: 8 }}>Bodies not kept for this provider.</div>}
                          </div>
                        </td></tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </aside>
    </>
  )
}
