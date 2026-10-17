import { useEffect, useState } from 'react'
import { Globe2 } from 'lucide-react'
import { toast } from 'sonner'
import { fetchCompanyContext, setMyCompany, errText, type CompanyContext } from './companyApi'

const ALL = '__all__'

// Topbar company picker. Hidden until the user can see more than one active company.
// Switching changes what every list shows (row security follows it) and where new records go.
export default function CompanySwitcher() {
  const [ctx, setCtx] = useState<CompanyContext | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchCompanyContext().then(setCtx).catch(() => setCtx(null))
  }, [])

  const active = (ctx?.companies ?? []).filter((c) => c.is_active)
  if (!ctx || active.length < 2) return null

  async function change(v: string) {
    setBusy(true)
    try {
      await setMyCompany(v === ALL ? null : v)
      window.location.reload()
    } catch (e) {
      toast.error(errText(e, 'Could not switch company'))
      setBusy(false)
    }
  }

  return (
    <label
      title="Company"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 8px',
        border: '1px solid var(--border)', borderRadius: 8, background: '#fff', fontSize: 12 }}
    >
      <Globe2 size={14} strokeWidth={2} aria-hidden />
      <select
        aria-label="Company"
        value={ctx.current ?? ALL}
        disabled={busy}
        onChange={(e) => void change(e.target.value)}
        style={{ border: 'none', background: 'transparent', fontSize: 12, outline: 'none', cursor: 'pointer' }}
      >
        {active.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
        <option value={ALL}>All companies</option>
      </select>
    </label>
  )
}
