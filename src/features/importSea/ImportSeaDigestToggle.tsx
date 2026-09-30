import { useEffect, useState } from 'react'
import { Mail, MailCheck } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../supabase'

/** Icon-only toolbar toggle: subscribe current staff user to the 7am Import Sea digest email. */
export default function ImportSeaDigestToggle() {
  const [userId, setUserId] = useState<string | null>(null)
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let alive = true
    void (async () => {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id ?? null
      if (!alive) return
      setUserId(uid)
      if (uid) {
        const { data } = await supabase
          .from('import_sea_digest_subscriptions')
          .select('user_id')
          .eq('user_id', uid)
          .maybeSingle()
        if (alive) setOn(Boolean(data))
      }
      if (alive) setBusy(false)
    })()
    return () => { alive = false }
  }, [])

  async function toggle() {
    if (!userId || busy) return
    setBusy(true)
    try {
      if (on) {
        const { error } = await supabase.from('import_sea_digest_subscriptions').delete().eq('user_id', userId)
        if (error) throw error
        setOn(false)
        toast.success('Daily digest turned off')
      } else {
        const { error } = await supabase.from('import_sea_digest_subscriptions').insert({ user_id: userId })
        if (error) throw error
        setOn(true)
        const { error: fnErr } = await supabase.functions.invoke('import-sea-daily-digest', { body: { test: true } })
        toast.success(fnErr
          ? 'Subscribed. Digest arrives 7am daily.'
          : 'Subscribed. Preview sent to your inbox, then 7am daily.')
      }
    } catch {
      toast.error('Could not update digest subscription')
    } finally {
      setBusy(false)
    }
  }

  const label = on ? 'Daily digest on (7am). Click to unsubscribe' : 'Subscribe to 7am daily digest email'

  return (
    <button
      type="button"
      className="pagination__btn"
      onClick={() => void toggle()}
      disabled={busy || !userId}
      title={label}
      aria-label={label}
      aria-pressed={on}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {on ? <MailCheck size={14} /> : <Mail size={14} />}
    </button>
  )
}
