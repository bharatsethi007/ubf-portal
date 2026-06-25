import { AlertTriangle } from 'lucide-react'
import { isOverdueSevere } from '../api/customerOverdueApi'
import { fmtMoney, fmtShort } from '../utils/format'
import './overdueBadge.css'

type Props = {
  count: number
  amount: number
  currency: string
  oldestDue?: string | null
  size?: 'sm' | 'md'
  compact?: boolean
  onClick?: () => void
  className?: string
}

export default function OverdueBadge({
  count,
  amount,
  currency,
  oldestDue,
  size = 'sm',
  compact = false,
  onClick,
  className = '',
}: Props) {
  if (count <= 0) return null

  const severe = isOverdueSevere(count, amount)
  const tone = severe ? 'overdue-badge--red' : 'overdue-badge--amber'
  const countText = count.toLocaleString('en-NZ')
  const amountText = fmtMoney(amount, currency)
  const oldestText = oldestDue ? fmtShort(oldestDue) : null
  const tooltip = oldestText
    ? `${amountText} overdue, oldest ${oldestText}`
    : `${amountText} overdue`

  if (size === 'md') {
    const Tag = onClick ? 'button' : 'div'
    return (
      <Tag
        type={onClick ? 'button' : undefined}
        className={`overdue-banner ${tone} ${className}`.trim()}
        onClick={onClick}
      >
        <AlertTriangle size={16} aria-hidden className="overdue-banner__icon" />
        <span className="overdue-banner__body">
          <span className="overdue-banner__main">
            <span className="mono nums">{countText}</span>
            {' invoices overdue · '}
            <span className="mono nums">{amountText}</span>
          </span>
          {oldestText && (
            <span className="overdue-banner__sub">Oldest due {oldestText}</span>
          )}
        </span>
      </Tag>
    )
  }

  return (
    <span
      className={`overdue-badge overdue-badge--sm ${tone} ${className}`.trim()}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <AlertTriangle size={12} aria-hidden />
      <span className="overdue-badge__text">
        <span className="mono nums">{countText}</span>
        {!compact && ' overdue'}
      </span>
      <span className="overdue-badge__tip" role="tooltip">
        {tooltip}
      </span>
    </span>
  )
}
