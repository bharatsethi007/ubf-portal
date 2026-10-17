import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  removeStaffCompany, upsertStaffCompany, errText,
  type Branch, type Company, type StaffCompany,
} from '../../../features/company/companyApi'
import type { StaffOption } from '../../../hooks/useStaffList'

type Props = {
  rows: StaffCompany[]; staff: StaffOption[]; companies: Company[]; branches: Branch[]
  canEdit: boolean; reload: () => Promise<void>
}

const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, padding: 0 }
const EMPTY = { user_id: '', company_id: '' }

export default function StaffAccessSection({ rows, staff, companies, branches, canEdit, reload }: Props) {
  const [draft, setDraft] = useState(EMPTY)
  const name = (id: string) => staff.find((s) => s.user_id === id)?.name ?? id.slice(0, 8)
  const sorted = [...rows].sort((a, b) => name(a.user_id).localeCompare(name(b.user_id)) || a.company_id.localeCompare(b.company_id))

  async function run(fn: () => Promise<void>, ok: string) {
    try { await fn(); toast.success(ok) } catch (e) { toast.error(errText(e)) }
    await reload()
  }

  async function add() {
    if (!draft.user_id || !draft.company_id) { toast.error('Pick staff and company'); return }
    if (rows.some((r) => r.user_id === draft.user_id && r.company_id === draft.company_id)) {
      toast.error('Already has access'); return
    }
    const home = branches.find((b) => b.company_id === draft.company_id && b.is_active)?.code
      ?? branches.find((b) => b.company_id === draft.company_id)?.code ?? null
    await run(() => upsertStaffCompany({ user_id: draft.user_id, company_id: draft.company_id,
      access: 'full', is_default: false, home_branch: home }), 'Access added')
    setDraft(EMPTY)
  }

  return (
    <>
      <h2 style={{ margin: '24px 0 4px', fontSize: 14, fontWeight: 600 }}>Staff access</h2>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted-foreground)' }}>
        Full = works in that company. Network viewer = sees only shared legs of cross-company shipments.
        Home branch sets where their new bookings and quotes go.
      </p>
      <div className="table-wrap">
        <table className="data-table data-table--compact">
          <thead>
            <tr>
              <th style={{ width: 200 }}>Staff</th><th style={{ width: 80 }}>Company</th>
              <th style={{ width: 140 }}>Access</th><th style={{ width: 140 }}>Home branch</th>
              <th style={{ width: 70 }} title="Company shown when they log in">Current</th><th style={{ width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {canEdit ? (
              <tr style={{ background: 'var(--color-canvas)' }}>
                <td>
                  <select className="input input--sm" value={draft.user_id} onChange={(e) => setDraft({ ...draft, user_id: e.target.value })}>
                    <option value="">Staff</option>
                    {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
                  </select>
                </td>
                <td>
                  <select className="input input--sm" value={draft.company_id} onChange={(e) => setDraft({ ...draft, company_id: e.target.value })}>
                    <option value="" />
                    {companies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </td>
                <td colSpan={3} />
                <td>
                  <button type="button" className="btn btn--inline" style={iconBtn} title="Add access" aria-label="Add access" onClick={() => void add()}>
                    <Plus size={15} />
                  </button>
                </td>
              </tr>
            ) : null}
            {sorted.map((r) => (
              <tr key={r.user_id + r.company_id}>
                <td>{name(r.user_id)}</td>
                <td className="mono">{r.company_id}</td>
                <td>
                  <select className="input input--sm" value={r.access} disabled={!canEdit}
                    onChange={(e) => void run(() => upsertStaffCompany({ ...r, access: e.target.value as StaffCompany['access'] }), 'Saved')}>
                    <option value="full">Full</option>
                    <option value="network_viewer">Network viewer</option>
                  </select>
                </td>
                <td>
                  <select className="input input--sm" value={r.home_branch ?? ''} disabled={!canEdit}
                    onChange={(e) => void run(() => upsertStaffCompany({ ...r, home_branch: e.target.value || null }), 'Saved')}>
                    <option value="" />
                    {branches.filter((b) => b.company_id === r.company_id).map((b) => <option key={b.code} value={b.code}>{b.code} · {b.name}</option>)}
                  </select>
                </td>
                <td>{r.is_default ? 'Yes' : ''}</td>
                <td>
                  {canEdit ? (
                    <button type="button" className="icon-btn" title="Remove access" aria-label="Remove access"
                      onClick={() => void run(() => removeStaffCompany(r.user_id, r.company_id), 'Access removed')}>
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
