import { useEffect, useState } from 'react'
import { fetchCreditUsage } from './creditUsageApi'

function money(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`
}

export default function CreditUsagePill({ accountId }: { accountId: string | null }) {
  const [usage, setUsage] = useState<{ limit: number; used: number } | null>(null)

  useEffect(() => {
    if (!accountId) { setUsage(null); return }
    let cancelled = false
    fetchCreditUsage(accountId)
      .then((u) => {
        if (cancelled) return
        if (u && u.credit_limit && u.credit_limit > 0) {
          setUsage({ limit: u.credit_limit, used: u.outstanding ?? 0 })
        } else {
          setUsage(null)
        }
      })
      .catch(() => { if (!cancelled) setUsage(null) })
    return () => { cancelled = true }
  }, [accountId])

  if (!usage) return null
  const pct = usage.limit > 0 ? (usage.used / usage.limit) * 100 : 0
  // used <=50% green, 50-90% amber, >90% (under 10% left) red
  const tier = pct > 90 ? 'red' : pct > 50 ? 'amber' : 'green'
  const colors: Record<string, { bg: string; fg: string }> = {
    green: { bg: '#D1FADF', fg: '#027A48' },
    amber: { bg: '#FEF0C7', fg: '#B54708' },
    red: { bg: '#FEE4E2', fg: '#B42318' },
  }
  const c = colors[tier]
  return (
    <span
      className="acct-pill"
      style={{ background: c.bg, color: c.fg }}
      title={`Credit used: ${money(usage.used)} of ${money(usage.limit)} (${Math.round(pct)}%)`}
    >
      {money(usage.used)} / {money(usage.limit)}
    </span>
  )
}
