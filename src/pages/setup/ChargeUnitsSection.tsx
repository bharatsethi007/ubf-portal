import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { fetchChargeUnits, upsertChargeUnit, unitCodeFromLabel, type ChargeUnitRow, type UnitMode } from './chargeUnitsApi'

const ACCENT = '#3B5BFE'
const MODES: UnitMode[] = ['air', 'sea']
const iconBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, padding: 0, background: ACCENT, borderColor: ACCENT }

/** Setup > Charge codes > Units. Units are never deleted (quote lines keep the code); untick Active to hide. */
export default function ChargeUnitsSection({ onChanged }: { onChanged?: () => void }) {
  const [units, setUnits] = useState<ChargeUnitRow[]>([])
  const [draft, setDraft] = useState<{ label: string; modes: UnitMode[] }>({ label: '', modes: ['air', 'sea'] })

  const reload = useCallback(async () => {
    setUnits(await fetchChargeUnits())
  }, [])

  useEffect(() => { reload().catch(() => toast.error('Failed to load units')) }, [reload])

  async function save(u: ChargeUnitRow, ok = 'Unit saved') {
    if (!u.label.trim()) { toast.error('Label is required'); return }
    if (!u.modes.length) { toast.error('Pick air, sea or both'); return }
    try {
      await upsertChargeUnit(u)
      await reload()
      onChanged?.()
      toast.success(ok)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const toggleMode = (modes: UnitMode[], m: UnitMode) => (modes.includes(m) ? modes.filter((x) => x !== m) : [...modes, m])

  async function add() {
    const code = unitCodeFromLabel(draft.label)
    if (!code) { toast.error('Label is required'); return }
    if (units.some((u) => u.code === code)) { toast.error(`${code} already exists`); return }
    const sort = Math.max(0, ...units.map((u) => u.sort_order)) + 10
    await save({ code, label: draft.label, sort_order: sort, active: true, modes: draft.modes }, 'Unit added')
    setDraft({ label: '', modes: ['air', 'sea'] })
  }

  return (
    <>
      <h2 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 600, color: ACCENT }}>Units</h2>
      <div className="table-wrap">
        <table className="data-table data-table--compact">
          <thead>
            <tr>
              <th>Code</th><th>Label</th><th>Air</th><th>Sea</th><th>Sort</th><th>Active</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: 'var(--color-canvas)' }}>
              <td className="mono text-muted-foreground">{unitCodeFromLabel(draft.label) || 'auto'}</td>
              <td>
                <input className="input input--sm" placeholder="e.g. Per Pallet" value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') void add() }} />
              </td>
              {MODES.map((m) => (
                <td key={m}>
                  <input type="checkbox" aria-label={m} checked={draft.modes.includes(m)}
                    onChange={() => setDraft({ ...draft, modes: toggleMode(draft.modes, m) })} />
                </td>
              ))}
              <td colSpan={2} style={{ textAlign: 'right' }}>
                <button type="button" className="nqd-btn nqd-btn--accent" style={iconBtn} title="Add unit" aria-label="Add unit" onClick={() => void add()}>
                  <Plus size={14} />
                </button>
              </td>
            </tr>
            {units.map((u) => (
              <tr key={u.code}>
                <td className="mono">{u.code}</td>
                <td>
                  <input className="input input--sm" value={u.label}
                    onChange={(e) => setUnits((rows) => rows.map((r) => r.code === u.code ? { ...r, label: e.target.value } : r))}
                    onBlur={(e) => void save({ ...u, label: e.target.value })} />
                </td>
                {MODES.map((m) => (
                  <td key={m}>
                    <input type="checkbox" aria-label={m} checked={u.modes.includes(m)}
                      onChange={() => void save({ ...u, modes: toggleMode(u.modes, m) })} />
                  </td>
                ))}
                <td style={{ width: 72 }}>
                  <input className="input input--sm" type="number" value={u.sort_order}
                    onChange={(e) => setUnits((rows) => rows.map((r) => r.code === u.code ? { ...r, sort_order: Number(e.target.value) || 0 } : r))}
                    onBlur={(e) => void save({ ...u, sort_order: Number(e.target.value) || 0 })} />
                </td>
                <td>
                  <input type="checkbox" aria-label="Active" checked={u.active}
                    onChange={(e) => void save({ ...u, active: e.target.checked })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
