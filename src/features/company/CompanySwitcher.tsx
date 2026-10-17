import { useEffect, useState } from 'react'
import { ChevronDown, Globe2, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { fetchCompanyContext, setMyBranch, setMyCompany, errText, type CompanyContext } from './companyApi'

const ALL = '__all__'

// Compact chip shows the code only; the invisible native select on top keeps full names in the list.
const box: React.CSSProperties = {
  position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 8px',
  border: '1px solid var(--line, var(--border))', borderRadius: 8, background: 'var(--paper, #fff)',
  fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer',
}
const sel: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', fontSize: 13 }

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
        <label title={`Company: ${companies.find((c) => c.code === ctx.current)?.name ?? 'All companies'}`} style={box}>
          <Globe2 size={14} strokeWidth={2} aria-hidden />
          <span>{ctx.current ?? 'All'}</span>
          <ChevronDown size={13} strokeWidth={2} aria-hidden />
          <select aria-label="Company" value={ctx.current ?? ALL} disabled={busy} style={sel}
            onChange={(e) => void run(() => setMyCompany(e.target.value === ALL ? null : e.target.value), 'Could not switch company')}>
            {companies.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
            <option value={ALL}>All companies</option>
          </select>
        </label>
      ) : null}
      {showBranch ? (
        <label title={`Branch: ${branches.find((b) => b.code === ctx.view_branch)?.name ?? 'All branches'}`} style={box}>
          <MapPin size={14} strokeWidth={2} aria-hidden />
          <span>{ctx.view_branch ?? 'All'}</span>
          <ChevronDown size={13} strokeWidth={2} aria-hidden />
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
