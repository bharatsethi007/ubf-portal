import { CreditCard } from 'lucide-react'
import { formatMoney } from '../dashboard/portalFormat'
import type { PaymentKpi } from '../dashboard/portalDashboardApi'

function AgingBar({ aging, currency }: { aging: PaymentKpi['aging']; currency: string }) {
  const total = aging.current + aging.days30_60 + aging.days60plus
  if (total <= 0) return null

  const segments = [
    { key: 'current', amount: aging.current, color: 'var(--portal-green)', label: 'Current' },
    { key: '30-60', amount: aging.days30_60, color: 'var(--portal-amber)', label: '30–60d' },
    { key: '60+', amount: aging.days60plus, color: 'var(--portal-red)', label: '60d+' },
  ].filter((s) => s.amount > 0)

  return (
    <div className="portal-aging">
      <div className="portal-aging__bar" aria-hidden>
        {segments.map((s) => (
          <span
            key={s.key}
            className="portal-aging__seg"
            style={{ flex: s.amount, background: s.color }}
          />
        ))}
      </div>
      <div className="portal-aging__labels">
        {segments.map((s) => (
          <span key={s.key} className="portal-aging__item nums" style={{ color: s.color }}>
            <span className="portal-aging__dot" style={{ background: s.color }} aria-hidden />
            {s.label} {formatMoney(s.amount, currency)}
          </span>
        ))}
      </div>
    </div>
  )
}

export function PendingPaymentsKpi({ total, count, currency, aging }: PaymentKpi) {
  return (
    <div className="portal-card portal-card--pad">
      <div className="portal-card-title portal-card-title--icon">
        <CreditCard size={16} className="portal-card-title__icon" aria-hidden />
        Pending payments
      </div>
      <div className="portal-kpi-value nums" style={{ marginTop: 20 }}>{formatMoney(total, currency)}</div>
      <div style={{ color: 'var(--portal-muted)', fontSize: 12, marginTop: 10 }}>
        {count} invoices open
      </div>
      <AgingBar aging={aging} currency={currency} />
    </div>
  )
}
