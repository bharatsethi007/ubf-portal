import { toast } from 'sonner'
import { updateCompany, errText, type Company } from '../../../features/company/companyApi'

type Props = { rows: Company[]; setRows: (f: (r: Company[]) => Company[]) => void; canEdit: boolean; reload: () => Promise<void> }

const TEXT_COLS: { key: keyof Company; label: string; width: number }[] = [
  { key: 'name', label: 'Name', width: 150 },
  { key: 'legal_name', label: 'Legal name', width: 170 },
  { key: 'base_currency', label: 'Currency', width: 70 },
  { key: 'timezone', label: 'Timezone', width: 140 },
  { key: 'tax_label', label: 'Tax', width: 60 },
  { key: 'tax_number', label: 'Tax number', width: 120 },
  { key: 'erp_label', label: 'ERP', width: 170 },
]

export default function CompaniesSection({ rows, setRows, canEdit, reload }: Props) {
  async function save(code: string, patch: Partial<Company>, ok = 'Saved') {
    try { await updateCompany(code, patch); toast.success(ok) }
    catch (e) { toast.error(errText(e)); await reload() }
  }

  const edit = (code: string, key: keyof Company, v: string) =>
    setRows((rs) => rs.map((r) => (r.code === code ? { ...r, [key]: v } : r)))

  return (
    <>
      <h2 style={{ margin: '20px 0 4px', fontSize: 14, fontWeight: 600 }}>Companies</h2>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted-foreground)' }}>
        One per country. Own TradeWindow FDB, finance and customers. Staff only see companies they are given.
      </p>
      <div className="table-wrap">
        <table className="data-table data-table--compact">
          <thead>
            <tr>
              <th style={{ width: 52 }}>Code</th>
              {TEXT_COLS.map((c) => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}
              <th style={{ width: 70 }} title="FY start month (1-12)">FY start</th>
              <th style={{ width: 56 }}>Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td className="mono">{r.code}</td>
                {TEXT_COLS.map((c) => (
                  <td key={c.key}>
                    {canEdit ? (
                      <input className="input input--sm" value={(r[c.key] as string | null) ?? ''}
                        onChange={(e) => edit(r.code, c.key, e.target.value)}
                        onBlur={(e) => void save(r.code, { [c.key]: e.target.value.trim() || null })} />
                    ) : ((r[c.key] as string | null) ?? '')}
                  </td>
                ))}
                <td>
                  {canEdit ? (
                    <input className="input input--sm" type="number" min={1} max={12} value={r.fy_start_month ?? ''}
                      onChange={(e) => setRows((rs) => rs.map((x) => x.code === r.code
                        ? { ...x, fy_start_month: e.target.value ? Number(e.target.value) : null } : x))}
                      onBlur={(e) => void save(r.code, { fy_start_month: e.target.value ? Number(e.target.value) : null })} />
                  ) : (r.fy_start_month ?? '')}
                </td>
                <td>
                  <input type="checkbox" checked={r.is_active} disabled={!canEdit || r.code === 'NZ'} aria-label="Active"
                    onChange={(e) => {
                      const v = e.target.checked
                      setRows((rs) => rs.map((x) => (x.code === r.code ? { ...x, is_active: v } : x)))
                      void save(r.code, { is_active: v }, v ? 'Company active' : 'Company inactive')
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
