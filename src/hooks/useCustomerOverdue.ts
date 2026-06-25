import { useEffect, useState } from 'react'
import { fetchCustomerOverdue, type CustomerOverdue } from '../api/customerOverdueApi'

export function useCustomerOverdue(accountId: string | undefined) {
  const [overdue, setOverdue] = useState<CustomerOverdue | null>(null)

  useEffect(() => {
    const id = accountId?.trim()
    if (!id) {
      setOverdue(null)
      return
    }

    let cancelled = false
    fetchCustomerOverdue(id).then((result) => {
      if (!cancelled) setOverdue(result)
    })

    return () => {
      cancelled = true
    }
  }, [accountId])

  return overdue
}
