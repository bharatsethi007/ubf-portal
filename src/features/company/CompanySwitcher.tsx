import { useEffect, useState } from 'react'
import { Globe2 } from 'lucide-react'
import { toast } from 'sonner'
import { fetchCompanyContext, setMyBranch, setMyCompany, errText, type CompanyContext } from './companyApi'
import TopbarPicker, { type PickerOption } from './TopbarPicker'

const ALL = '__all__'

const flag = (code: string) => (
  <span className={`fi fi-${code.toLowerCase()}`} aria-hidden style={{ width: 18, height: 13, borderRadius: 2, flexShrink: 0 }} />
)
const globe = (
  <span aria-hidden style={{ width: 18, display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}>
    <Globe2 size={14} strokeWidth={2} style={{ color: 'var(--muted-foreground)' }} />
  </span>
)

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

  const companyOpts: PickerOption[] = [
    ...companies.map((c) => ({ value: c.code, label: c.code, icon: flag(c.code), title: c.name })),
    { value: ALL, label: 'All', icon: globe, title: 'All companies' },
  ]
  const branchOpts: PickerOption[] = [
    { value: ALL, label: 'All', title: 'All branches' },
    ...branches.map((b) => ({ value: b.code, label: b.code, title: b.name })),
  ]

  return (
    <>
      {showCompany ? (
        <TopbarPicker ariaLabel="Company" value={ctx.current ?? ALL} options={companyOpts} disabled={busy}
          onPick={(v) => void run(() => setMyCompany(v === ALL ? null : v), 'Could not switch company')} />
      ) : null}
      {showBranch ? (
        <TopbarPicker ariaLabel="Branch" value={ctx.view_branch ?? ALL} options={branchOpts} disabled={busy}
          onPick={(v) => void run(() => setMyBranch(v === ALL ? null : v), 'Could not switch branch')} />
      ) : null}
    </>
  )
}
