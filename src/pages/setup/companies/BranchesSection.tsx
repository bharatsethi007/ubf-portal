import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { upsertBranch, errText, type Branch, type Company } from '../../../features/company/companyApi'

type Props = {
  rows: Branch[]; setRows: (f: (r: Branch[]) => Branch[]) => void
  companies: Company[]; canEdit: boolean; reload: () => Promise<void>
}

const COLS: { key: keyof Branch; label: string; width: number }[] = [
  { key: 'name', label: 'Name', width: 110 },
  { key: 'ref_prefix', label: 'Ref prefix', width: 70 },
  { key: 'unlocode', label: 'UN/LOCODE', width: 80 },
  { key: 'erp_branch_code', label: 'TW branch', width: 76 },
  { key: 'address', label: 'Address', width: 220 },
  { key: 'phone', label: 'Phone', width: 120 },
  { key: 'email', label: 'Email', width: 170 },
]

const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, padding: 0 }
const EMPTY = { code: '', company_id: '', name: '' }

export default function BranchesSection({ rows, setRows, companies, canEdit, reload }: Props) {
  const [draft, setDraft] = useState(EMPTY)

  async function save(b: Branch, ok = 'Saved') {
    try { await upsertBranch(b); toast.success(ok) }
    catch (e) { toast.error(errText(e)); await reload() }
  }

  async function add() {
    const code = draft.code.trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(code)) { toast.error('Branch code is 3 letters, eg CHC'); return }
    if (!draft.company_id) { toast.error('Pick a company'); return }
    if (!draft.name.trim()) { toast.error('Name is required'); return }
    if (rows.some((r) => r.code === code)) { toast.error('Branch code already exists'); return }
    const b: Branch = {
      code, company_id: draft.company_id, name: draft.name.trim(), city: draft.name.trim(), unlocode: null,
      erp_branch_code: null, ref_prefix: code, address: null, phone: null, email: null, is_active: false,
      sort_order: rows.filter((r) => r.company_id === draft.company_id).length + 1,
    }
    await save(b, 'Branch added')
    setDraft(EMPTY)
    await reload()
  }

  const companyName = (c: string) => companies.find((x) => x.code === c)?.code ?? c

  return (
    <>
      <h2 style={{ margin: '24px 0 4px', fontSize: 14, fontWeight: 600 }}>Branches</h2>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted-foreground)' }}>
        Offices inside a company. Ref prefix starts booking and quote numbers (SUV-IA-0001). AKL keeps current numbers.
      </p>
      <div className="table-wrap">
        <table className="data-table data-table--compact">
          <thead>
            <tr>
              <th style={{ width: 52 }}>Code</th><th style={{ width: 64 }}>Company</th>
              {COLS.map((c) => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}
              <th style={{ width: 56 }}>Active</th>
            </tr>
          </thead>
          <tbody>
            {canEdit ? (
              <tr style={{ background: 'var(--color-canvas)' }}>
                <td><input className="input input--sm" placeholder="CHC" maxLength={3} value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></td>
                <td>
                  <select className="input input--sm" value={draft.company_id} onChange={(e) => setDraft({ ...draft, company_id: e.target.value })}>
                    <option value="" />
                    {companies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </td>
                <td><input className="input input--sm" placeholder="Name" value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></td>
                <td colSpan={COLS.length - 1} />
                <td>
                  <button type="button" className="btn btn--inline" style={iconBtn} title="Add branch" aria-label="Add branch" onClick={() => void add()}>
                    <Plus size={15} />
                  </button>
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.code}>
                <td className="mono">{r.code}</td>
                <td className="mono">{companyName(r.company_id)}</td>
                {COLS.map((c) => (
                  <td key={c.key}>
                    {canEdit ? (
                      <input className="input input--sm" value={(r[c.key] as string | null) ?? ''}
                        onChange={(e) => setRows((rs) => rs.map((x) => (x.code === r.code ? { ...x, [c.key]: e.target.value } : x)))}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          const val = c.key === 'ref_prefix' ? (v.toUpperCase() || r.code) : (v || null)
                          void save({ ...r, [c.key]: val })
                        }} />
                    ) : ((r[c.key] as string | null) ?? '')}
                  </td>
                ))}
                <td>
                  <input type="checkbox" checked={r.is_active} disabled={!canEdit} aria-label="Active"
                    onChange={(e) => {
                      const v = e.target.checked
                      setRows((rs) => rs.map((x) => (x.code === r.code ? { ...x, is_active: v } : x)))
                      void save({ ...r, is_active: v })
                    }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
