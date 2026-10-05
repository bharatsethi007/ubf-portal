import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../../supabase'
import { fetchFeed, linkFor, markRead, type StaffNote } from './staffNotifyApi'

type Row = {
  id: number; user_id: string | null; kind: string; title: string; body: string | null; booking_id: string | null
  link: string | null; actor_kind: StaffNote['actor_kind']; actor_id: string | null; created_at: string; facts: Record<string, unknown>
}

/** Staff bell feed. Loads 30 days, then listens live; new items toast with an Open action. */
export function useStaffNotifications(userId: string, onOpen: (to: string) => void) {
  const [items, setItems] = useState<StaffNote[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try { setItems(await fetchFeed()) } catch { /* bell stays empty; not worth a toast */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const ch = supabase
      .channel(`staff-notifications-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_notifications' }, (p) => {
        const r = p.new as Row
        if (r.user_id && r.user_id !== userId) return
        if (r.actor_id && r.actor_id === userId) return
        const note: StaffNote = { ...r, is_team: r.user_id == null, is_read: false }
        setItems((prev) => (prev.some((x) => x.id === note.id) ? prev : [note, ...prev]))
        const to = linkFor(note)
        if (!note.is_team) {
          toast(note.title, {
            description: note.body ?? undefined,
            action: to ? { label: 'Open', onClick: () => onOpen(to) } : undefined,
          })
        }
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [userId, onOpen])

  const read = useCallback(async (ids: number[] | null) => {
    setItems((prev) => prev.map((n) => (ids === null || ids.includes(n.id) ? { ...n, is_read: true } : n)))
    try { await markRead(ids) } catch { void load() }
  }, [load])

  const unread = useMemo(() => items.filter((n) => !n.is_read && !n.is_team).length, [items])
  const teamUnread = useMemo(() => items.filter((n) => !n.is_read && n.is_team).length, [items])

  return { items, loading, unread, teamUnread, read, reload: load }
}
