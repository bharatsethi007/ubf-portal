import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { errText, type Company } from '../../../features/company/companyApi'
import {
  fetchModuleRollout, setModuleStatus, type ModuleRolloutRow, type ModuleStatus,
} from '../../../features/company/modulesApi'

type Props = { companies: Company[] }
type ModuleRow = { key: string; label: string; super_only: boolean; status: Record<string, ModuleRolloutRow['status']> }

const OPTIONS: { value: ModuleStatus; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'pilot', label: 'Pilot' },
  { value: 'live', label: 'Live' },
]
const TONE: Record<string, string> = { off: '#9ca3af', pilot: '#b45309', live: '#15803d' }

export default function ModulesSection({ companies }: Props) {
  const [rows, setRows] = useState<ModuleRolloutRow[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setRows(await fetchModuleRollout()) }
    catch (e) { toast.error(errText(e, 'Failed to load modules')) }
  }, [])
  useEffect(() => { void load() }, [load])

  const modules = useMemo(() => {
    const map = new Map<string, ModuleRow>()
    for (const r of rows) {
      const m = map.get(r.module_key) ?? { key: r.module_key, label: r.label, super_only: r.super_only, status: {} }
      m.status[r.company_id] = r.status
      map.set(r.module_key, m)
    }
    return [...map.values()]
  }, [rows])

  async function change(company: string, module: string, status: ModuleStatus) {
    const id = `${company}:${module}`
    setBusy(id)
    setRows((rs) => rs.map((r) => (r.company_id === company && r.module_key === module ? { ...r, status } : r)))
    try { await setModuleStatus(company, module, status); toast.success(`${company} ${module}: ${status}`) }
    catch (e) { toast.error(errText(e)); await load() }
    finally { setBusy(null) }
  }

  return (
    <>
      <h2 style={{ margin: '24px 0 4px', fontSize: 14, fontWeight: 600 }}>Modules</h2>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted-foreground)' }}>
        Roll out per company. Off = hidden. Pilot = super admin only. Live = everyone, role permissions apply.
        Staff see changes after a page reload.
      </p>
      <div className="table-wrap">
        <table className="data-table data-table--compact">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Module</th>
              {companies.map((c) => <th key={c.code} style={{ width: 96 }}>{c.code}</th>)}
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                {companies.map((c) => {
                  const st = m.status[c.code] ?? 'pilot'
                  if (m.super_only) {
                    return <td key={c.code} style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Super admin</td>
                  }
                  return (
                    <td key={c.code}>
                      <select className="input input--sm" value={st} disabled={busy === `${c.code}:${m.key}`}
                        style={{ color: TONE[st] }} aria-label={`${m.label} in ${c.code}`}
                        onChange={(e) => void change(c.code, m.key, e.target.value as ModuleStatus)}>
                        {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
