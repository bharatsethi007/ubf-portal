import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { PROFILE_CHANGED, getStaffProfile, type StaffProfile } from '../../pages/users/staffProfileApi'

/** Signed-in staff member's profile. Reloads after any profile edit. */
export function useMyProfile(): StaffProfile | null {
  const [profile, setProfile] = useState<StaffProfile | null>(null)
  useEffect(() => {
    let off = false
    const load = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      if (!uid) return
      const p = await getStaffProfile(uid).catch(() => null)
      if (!off) setProfile(p)
    }
    void load()
    window.addEventListener(PROFILE_CHANGED, load)
    return () => { off = true; window.removeEventListener(PROFILE_CHANGED, load) }
  }, [])
  return profile
}
