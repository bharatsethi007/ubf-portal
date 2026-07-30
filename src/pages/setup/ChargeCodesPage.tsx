import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteChargeCode,
  deleteChargeGroup,
  fetchChargeCodes,
  fetchChargeGroups,
  isFkViolation,
  upsertChargeCode,
  upsertChargeGroup,
  type ChargeCode,
  type ChargeGroup,
} from './chargeCodesApi'

const ACCENT = '#3B5BFE'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label="Active" />
  )
}

export default function ChargeCodesPage() {
  const [groups, setGroups] = useState<ChargeGroup[]>([])
  const [codes, setCodes] = useState<ChargeCode[]>([])
  const [loading, setLoading] = useState(true)
  const [newGroup, setNewGroup] = useState({ code: '', label: '' })
  const [newCode, setNewCode] = useState({ code: '', description: '', charge_group: 'freight' })

  const reload = useCallback(async () => {
    const [g, c] = await Promise.all([fetchChargeGroups(true), fetchChargeCodes(true)])
    setGroups(g)
    setCodes(c)
    setNewCode((prev) => ({
      ...prev,
      charge_group: g.some((x) => x.code === prev.charge_group) ? prev.charge_group : (g[0]?.code ?? ''),
    }))
  }, [])

  useEffect(() => {
    reload()
      .catch(() => toast.error('Failed to load charge codes'))
      .finally(() => setLoading(false))
  }, [reload])

  async function run(action: () => Promise<void>, ok: string) {
    try {
      await action()
      await reload()
      toast.success(ok)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function onDeleteGroup(code: string) {
    try {
      await deleteChargeGroup(code)
      await reload()
      toast.success('Group deleted')
    } catch (e) {
      toast.error(isFkViolation(e) ? 'Group is in use by charge codes' : (e instanceof Error ? e.message : 'Delete failed'))
    }
  }

  async function addGroup() {
    const code = newGroup.code.trim()
    const label = newGroup.label.trim()
    if (!code || !label) { toast.error('Code and label are required'); return }
    await run(() => upsertChargeGroup({ code, label, sort_order: (groups.length + 1) * 10, active: true }), 'Group added')
    setNewGroup({ code: '', label: '' })
  }

  async function addCodeRow() {
    const code = newCode.code.trim()
    const description = newCode.description.trim()
    if (!code || !description || !newCode.charge_group) {
      toast.error('Code, description, and group are required')
      return
    }
    await run(
      () => upsertChargeCode({ code, description, charge_group: newCode.charge_group, sort_order: 100, active: true }),
      'Charge code added',
    )
    setNewCode({ code: '', description: '', charge_group: newCode.charge_group })
  }

  const groupOptions = groups.map((g) => ({ value: g.code, label: g.label }))

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <Link to="/setup" style={{ color: ACCENT, fontSize: 13, textDecoration: 'none' }}>← Setup</Link>
        <header className="quotes-page__head" style={{ marginTop: 8 }}>
          <h1>Charge codes</h1>
        </header>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <>
            <h2 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 600, color: ACCENT }}>Groups</h2>
            <div className="table-wrap">
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Code</th><th>Label</th><th>Sort</th><th>Active</th><th />
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.code}>
                      <td className="mono">{g.code}</td>
                      <td>
                        <input className="input input--sm" value={g.label}
                          onChange={(e) => setGroups((rows) => rows.map((r) => r.code === g.code ? { ...r, label: e.target.value } : r))}
                          onBlur={(e) => run(() => upsertChargeGroup({ ...g, label: e.target.value }), 'Group saved')} />
                      </td>
                      <td style={{ width: 72 }}>
                        <input className="input input--sm" type="number" value={g.sort_order}
                          onChange={(e) => setGroups((rows) => rows.map((r) => r.code === g.code ? { ...r, sort_order: Number(e.target.value) || 0 } : r))}
                          onBlur={(e) => run(() => upsertChargeGroup({ ...g, sort_order: Number(e.target.value) || 0 }), 'Group saved')} />
                      </td>
                      <td>
                        <Toggle checked={g.active} onChange={(active) => run(() => upsertChargeGroup({ ...g, active }), 'Group saved')} />
                      </td>
                      <td>
                        <button type="button" className="icon-btn" aria-label="Delete group" onClick={() => onDeleteGroup(g.code)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td><input className="input input--sm" placeholder="code" value={newGroup.code} onChange={(e) => setNewGroup({ ...newGroup, code: e.target.value })} /></td>
                    <td><input className="input input--sm" placeholder="Label" value={newGroup.label} onChange={(e) => setNewGroup({ ...newGroup, label: e.target.value })} /></td>
                    <td colSpan={2} />
                    <td>
                      <button type="button" className="nqd-btn nqd-btn--accent" style={{ background: ACCENT, borderColor: ACCENT }} onClick={addGroup}>
                        <Plus size={14} /> Add
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 style={{ margin: '20px 0 8px', fontSize: 14, fontWeight: 600, color: ACCENT }}>Charge codes</h2>
            <div className="table-wrap">
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Code</th><th>Description</th><th>Group</th><th>Active</th><th>Sort</th><th />
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: 'var(--color-canvas)' }}>
                    <td><input className="input input--sm" placeholder="Code" value={newCode.code} onChange={(e) => setNewCode({ ...newCode, code: e.target.value })} /></td>
                    <td><input className="input input--sm" placeholder="Description" value={newCode.description} onChange={(e) => setNewCode({ ...newCode, description: e.target.value })} /></td>
                    <td>
                      <select className="input input--sm" value={newCode.charge_group} onChange={(e) => setNewCode({ ...newCode, charge_group: e.target.value })}>
                        {groupOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td colSpan={2} />
                    <td>
                      <button type="button" className="nqd-btn nqd-btn--accent" style={{ background: ACCENT, borderColor: ACCENT }} onClick={addCodeRow}>
                        <Plus size={14} /> Add
                      </button>
                    </td>
                  </tr>
                  {codes.map((c) => (
                    <tr key={c.code}>
                      <td className="mono">{c.code}</td>
                      <td>
                        <input className="input input--sm" value={c.description}
                          onChange={(e) => setCodes((rows) => rows.map((r) => r.code === c.code ? { ...r, description: e.target.value } : r))}
                          onBlur={(e) => run(() => upsertChargeCode({ ...c, description: e.target.value }), 'Charge code saved')} />
                      </td>
                      <td>
                        <select className="input input--sm" value={c.charge_group}
                          onChange={(e) => run(() => upsertChargeCode({ ...c, charge_group: e.target.value }), 'Charge code saved')}>
                          {groupOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <Toggle checked={c.active} onChange={(active) => run(() => upsertChargeCode({ ...c, active }), 'Charge code saved')} />
                      </td>
                      <td style={{ width: 72 }}>
                        <input className="input input--sm" type="number" value={c.sort_order}
                          onChange={(e) => setCodes((rows) => rows.map((r) => r.code === c.code ? { ...r, sort_order: Number(e.target.value) || 0 } : r))}
                          onBlur={(e) => run(() => upsertChargeCode({ ...c, sort_order: Number(e.target.value) || 0 }), 'Charge code saved')} />
                      </td>
                      <td>
                        <button type="button" className="icon-btn" aria-label="Delete code"
                          onClick={() => run(() => deleteChargeCode(c.code), 'Charge code deleted')}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
