import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Pagination from '../../components/Pagination'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import {
  deletePort, fetchPorts, isFkViolation, upsertPort,
  type Port, type PortKind,
} from './portsAdminApi'

const ACCENT = '#3B5BFE'
const PAGE_SIZE = 50
const emptyDraft = { code: '', name: '', country_code: '', lat: '', lng: '' }

function num(v: string): number | null {
  const n = Number(v)
  return v.trim() === '' || Number.isNaN(n) ? null : n
}

export default function PortsPage() {
  const [kind, setKind] = useState<PortKind>('sea')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<Port[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState(emptyDraft)
  const debounced = useDebouncedValue(search, 300)

  useEffect(() => { setPage(1) }, [kind, debounced])

  const reload = useCallback(async () => {
    const res = await fetchPorts({ kind, search: debounced, page, pageSize: PAGE_SIZE })
    setRows(res.rows)
    setTotal(res.total)
  }, [kind, debounced, page])

  useEffect(() => {
    setLoading(true)
    reload().catch(() => toast.error('Failed to load ports')).finally(() => setLoading(false))
  }, [reload])

  async function run(action: () => Promise<void>, ok: string) {
    try { await action(); await reload(); toast.success(ok) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
  }

  async function addPort() {
    const code = draft.code.trim().toUpperCase()
    const name = draft.name.trim()
    if (!code || !name) { toast.error('Code and name are required'); return }
    await run(() => upsertPort({
      code, name, country_code: draft.country_code, kind,
      lat: num(draft.lat), lng: num(draft.lng),
    }), `${kind === 'air' ? 'Airport' : 'Port'} added`)
    setDraft(emptyDraft)
  }

  async function removePort(code: string) {
    try { await deletePort(code); await reload(); toast.success('Deleted') }
    catch (e) {
      toast.error(isFkViolation(e)
        ? 'In use by quotes or rate cards — can’t be deleted.'
        : (e instanceof Error ? e.message : 'Delete failed'))
    }
  }

  const label = kind === 'air' ? 'airport' : 'sea port'

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <Link to="/setup" style={{ color: ACCENT, fontSize: 13, textDecoration: 'none' }}>← Setup</Link>
        <header className="quotes-page__head" style={{ marginTop: 8 }}>
          <h1>Ports &amp; airports</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted-foreground)', fontSize: 14 }}>
            Sea ports and airports available in quotes, rate cards, and bookings.
          </p>
        </header>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '14px 0 10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', border: '1px solid #d7deea', borderRadius: 8, overflow: 'hidden' }}>
            {(['sea', 'air'] as PortKind[]).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                style={{
                  padding: '6px 14px', fontSize: 13, border: 'none', cursor: 'pointer',
                  background: kind === k ? ACCENT : 'transparent',
                  color: kind === k ? '#fff' : '#0A2472',
                }}>
                {k === 'air' ? 'Airports' : 'Sea ports'}
              </button>
            ))}
          </div>
          <input className="input input--sm" style={{ maxWidth: 260 }}
            placeholder="Search code, name, country"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Code</th><th>Name</th>
                    <th style={{ width: 80 }}>Country</th>
                    <th style={{ width: 110 }}>Lat</th><th style={{ width: 110 }}>Lng</th>
                    <th style={{ width: 44 }} />
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: 'var(--color-canvas)' }}>
                    <td><input className="input input--sm" placeholder="CODE" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></td>
                    <td><input className="input input--sm" placeholder={`New ${label} name`} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></td>
                    <td><input className="input input--sm" placeholder="NZ" value={draft.country_code} onChange={(e) => setDraft({ ...draft, country_code: e.target.value })} /></td>
                    <td><input className="input input--sm" placeholder="lat" value={draft.lat} onChange={(e) => setDraft({ ...draft, lat: e.target.value })} /></td>
                    <td><input className="input input--sm" placeholder="lng" value={draft.lng} onChange={(e) => setDraft({ ...draft, lng: e.target.value })} /></td>
                    <td><button type="button" className="nqd-btn nqd-btn--accent" style={{ background: ACCENT, borderColor: ACCENT }} onClick={addPort}><Plus size={14} /></button></td>
                  </tr>
                  {rows.map((p) => (
                    <tr key={p.code}>
                      <td className="mono">{p.code}</td>
                      <td>
                        <input className="input input--sm" value={p.name}
                          onChange={(e) => setRows((rs) => rs.map((x) => x.code === p.code ? { ...x, name: e.target.value } : x))}
                          onBlur={(e) => run(() => upsertPort({ ...p, name: e.target.value }), 'Saved')} />
                      </td>
                      <td>
                        <input className="input input--sm" value={p.country_code}
                          onChange={(e) => setRows((rs) => rs.map((x) => x.code === p.code ? { ...x, country_code: e.target.value.toUpperCase() } : x))}
                          onBlur={(e) => run(() => upsertPort({ ...p, country_code: e.target.value }), 'Saved')} />
                      </td>
                      <td>
                        <input className="input input--sm" type="number" value={p.lat ?? ''}
                          onChange={(e) => setRows((rs) => rs.map((x) => x.code === p.code ? { ...x, lat: num(e.target.value) } : x))}
                          onBlur={() => run(() => upsertPort(p), 'Saved')} />
                      </td>
                      <td>
                        <input className="input input--sm" type="number" value={p.lng ?? ''}
                          onChange={(e) => setRows((rs) => rs.map((x) => x.code === p.code ? { ...x, lng: num(e.target.value) } : x))}
                          onBlur={() => run(() => upsertPort(p), 'Saved')} />
                      </td>
                      <td><button type="button" className="icon-btn" aria-label="Delete" onClick={() => removePort(p.code)}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
