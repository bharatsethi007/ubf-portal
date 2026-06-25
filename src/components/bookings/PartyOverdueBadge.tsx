import OverdueBadge from '../OverdueBadge'
import { useCustomerOverdue } from '../../hooks/useCustomerOverdue'

type Props = {
  accountId: string
}

export default function PartyOverdueBadge({ accountId }: Props) {
  const overdue = useCustomerOverdue(accountId)

  if (!overdue) return null

  return (
    <OverdueBadge
      count={overdue.overdue_count}
      amount={overdue.overdue_amount}
      currency={overdue.currency}
      oldestDue={overdue.oldest_due}
      size="sm"
    />
  )
}
