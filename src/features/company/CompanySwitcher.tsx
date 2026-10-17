import { useEffect, useState } from 'react'
import { Globe2, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { fetchCompanyContext, setMyBranch, setMyCompany, errText, type CompanyContext } from './companyApi'

const ALL = '__all__'

const box: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 8px',
  border: '1px solid var(--border)', borderRadius: 8, background: '#fff', fontSize: 12,
}
const sel: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 12, outline: 'none', cursor: 'pointer' }

// Topbar company + branch pickers. Company shows with 2+ active companies; branch shows when the
// picked company has 2+ active branches. Lists, reports and new records all follow the pick.
export default function CompanySwitcher() {
  const [ctx, setCtx] = useState<CompanyContext | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchCompanyContext().then(setCtx).catch(() => setCtx(null))
  }, [])

  if (!ctx) return null
  const companies = ctx.companies.filter((c) => c.is_active)
  const branches = (ctx.branches ?? []).filter((b) => b.is_active)
  const showCompany = companies.length > 1
  const showBranch = !!ctx.current && branches.length > 1
  if (!showCompany && !showBranch) return null

  async function run(fn: () => Promise<void>, fail: string) {
    setBusy(true)
    try { await fn(); window.location.reload() }
    catch (e) { toast.error(errText(e, fail)); setBusy(false) }
  }

  return (
    <>
      {showCompany ? (
        <label title="Company" style={box}>
          <Globe2 size={14} strokeWidth={2} aria-hidden />
          <select aria-label="Company" value={ctx.current ?? ALL} disabled={busy} style={sel}
            onChange={(e) => void run(() => setMyCompany(e.target.value === ALL ? null : e.target.value), 'Could not switch company')}>
            {companies.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
            <option value={ALL}>All companies</option>
          </select>
        </label>
      ) : null}
      {showBranch ? (
        <label title="Branch" style={box}>
          <MapPin size={14} strokeWidth={2} aria-hidden />
          <select aria-label="Branch" value={ctx.view_branch ?? ALL} disabled={busy} style={sel}
            onChange={(e) => void run(() => setMyBranch(e.target.value === ALL ? null : e.target.value), 'Could not switch branch')}>
            <option value={ALL}>All branches</option>
            {branches.map((b) => <option key={b.code} value={b.code}>{b.code} · {b.name}</option>)}
          </select>
        </label>
      ) : null}
    </>
  )
}
