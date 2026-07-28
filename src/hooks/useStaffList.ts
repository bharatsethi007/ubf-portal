import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export type StaffOption = { user_id: string; name: string }

function staffDisplayName(row: { email: string | null; initials: string | null }): string {
  if (row.email) return row.email.split('@')[0] ?? row.email
  return row.initials?.trim() || 'Staff'
}

export function useStaffList(): { staff: StaffOption[]; loading: boolean } {
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('staff_users')
        .select('user_id, email, initials')

      if (cancelled) return

      if (error || !data) {
        setStaff([])
      } else {
        setStaff(
          data
            .map((row) => ({
              user_id: row.user_id,
              name: staffDisplayName(row),
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        )
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return { staff, loading }
}
