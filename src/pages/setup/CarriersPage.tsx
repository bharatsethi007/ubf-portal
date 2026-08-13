import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteCarrier, fetchCarriers, isFkViolation, upsertCarrier,
  type Carrier, type CarrierTable,
} from './carriersApi'

const ACCENT = '#3B5BFE'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label="Active" />
}

function CarrierSection({ title, table, inUseMessage }: { title: string; table: CarrierTable; inUseMessage: string }) {
  const [rows, setRows] = useState<Carrier[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState({ code: '', name: '' })

  const reload = useCallback(async () => {
    setRows(await fetchCarriers(table, true))
  }, [table])

  useEffect(() => {
    reload().catch(() => toast.error(`Failed to load ${title.toLowerCase()}`)).finally(() => setLoading(false))
  }, [reload, title])

  async function run(action: () => Promise<void>, ok: string) {
    try { await action(); await reload(); toast.success(ok) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
  }

  async function add() {
    const code = draft.code.trim().toUpperCase()
    const name = draft.name.trim()
    if (!code || !name) { toast.error('Code and name are required'); return }
    if (rows.some((r) => r.code === code)) { toast.error('Code already exists'); return }
    await run(() => upsertCarrier(table, { code, name, sort_order: (rows.length + 1) * 10, active: true }), `${title} added`)
    setDraft({ code: '', name: '' })
  }

  async function remove(code: string) {
    try { await deleteCarrier(table, code); await reload(); toast.success('Deleted') }
    catch (e) { toast.error(isFkViolation(e) ? inUseMessage : (e instanceof Error ? e.message : 'Delete failed')) }
  }

  return (
    <>
      <h2 style={{ margin: '20px 0 8px', fontSize: 14, fontWeight: 600, color: ACCENT }}>{title}</h2>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th style={{ width: 120 }}>Code</th><th>Name</th>
                <th style={{ width: 72 }}>Sort</th><th style={{ width: 60 }}>Active</th><th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: 'var(--color-canvas)' }}>
                <td><input className="input input--sm" placeholder="CODE" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></td>
                <td><input className="input input--sm" placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></td>
                <td colSpan={2} />
                <td><button type="button" className="nqd-btn nqd-btn--accent" style={{ background: ACCENT, borderColor: ACCENT }} onClick={add}><Plus size={14} /> Add</button></td>
              </tr>
              {rows.map((r) => (
                <tr key={r.code}>
                  <td className="mono">{r.code}</td>
                  <td>
                    <input className="input input--sm" value={r.name}
                      onChange={(e) => setRows((rs) => rs.map((x) => x.code === r.code ? { ...x, name: e.target.value } : x))}
                      onBlur={(e) => run(() => upsertCarrier(table, { ...r, name: e.target.value }), 'Saved')} />
                  </td>
                  <td>
                    <input className="input input--sm" type="number" value={r.sort_order}
                      onChange={(e) => setRows((rs) => rs.map((x) => x.code === r.code ? { ...x, sort_order: Number(e.target.value) || 0 } : x))}
                      onBlur={(e) => run(() => upsertCarrier(table, { ...r, sort_order: Number(e.target.value) || 0 }), 'Saved')} />
                  </td>
                  <td><Toggle checked={r.active} onChange={(active) => run(() => upsertCarrier(table, { ...r, active }), 'Saved')} /></td>
                  <td><button type="button" className="icon-btn" aria-label="Delete" onClick={() => remove(r.code)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default function CarriersPage() {
  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <Link to="/setup" style={{ color: ACCENT, fontSize: 13, textDecoration: 'none' }}>← Setup</Link>
        <header className="quotes-page__head" style={{ marginTop: 8 }}>
          <h1>Carriers</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted-foreground)', fontSize: 14 }}>
            Shipping lines and airlines used across rate cards, quotes, and bookings.
          </p>
        </header>
        <CarrierSection title="Shipping lines" table="shipping_lines" inUseMessage="In use by rate cards — set inactive instead of deleting." />
        <CarrierSection title="Airlines" table="airlines" inUseMessage="In use elsewhere — set inactive instead of deleting." />
      </div>
    </div>
  )
}
