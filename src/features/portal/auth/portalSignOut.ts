import { supabase } from '../../../supabase'

/** Clears the Supabase session (localStorage) and triggers App-level auth state reset. */
export async function portalSignOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
