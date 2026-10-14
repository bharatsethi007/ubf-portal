import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabase'
import type { EaRow } from './eaTypes'
import type { DocRow, ThreadRow, TmsJob } from './useEaBooking'

/** The buyers consolidation a HAWB belongs to: its main HAWB and all sub-HAWBs. null family = ordinary HAWB. */
export function useEaFamily(bookingId: string) {
  const [masterId, setMasterId] = useState<string | null | undefined>(undefined)
  const [master, setMaster] = useState<EaRow | null>(null)
  const [subs, setSubs] = useState<EaRow[]>([])

  const load = useCallback(async () => {
    const { data: me } = await supabase.from('bookings').select('id, is_consolidation, master_booking_id').eq('id', bookingId).maybeSingle()
    const mid = me?.is_consolidation ? me.id : me?.master_booking_id ?? null
    setMasterId(mid)
    if (!mid) { setMaster(null); setSubs([]); return }
    const [m, s] = await Promise.all([
      supabase.from('v_ea_bookings').select('*').eq('id', mid).maybeSingle(),
      supabase.from('v_ea_bookings').select('*').eq('master_booking_id', mid).order('created_at'),
    ])
    setMaster((m.data as EaRow | null) ?? null)
    setSubs((s.data ?? []) as EaRow[])
  }, [bookingId])

  useEffect(() => { void load() }, [load])
  return { masterId, master, subs, reload: load }
}

export type SubExtras = {
  threads: (ThreadRow & { from?: string })[]
  docs: (DocRow & { from?: string })[]
  tms: Map<string, TmsJob>
}

/** Emails, documents and TMS jobs of every sub-HAWB, labelled with the supplier, for the main HAWB's rails. */
export function useEaSubExtras(subs: EaRow[]) {
  const [x, setX] = useState<SubExtras>({ threads: [], docs: [], tms: new Map() })
  const key = subs.map((s) => s.id).join(',')

  useEffect(() => {
    const ids = key ? key.split(',') : []
    if (!ids.length) { setX({ threads: [], docs: [], tms: new Map() }); return }
    const label = new Map(subs.map((s) => [s.id, s.shipper_code_name ?? s.shipper_name ?? s.booking_ref]))
    let live = true
    void Promise.all([
      supabase.from('booking_threads')
        .select('booking_id, conversation_id, inbox_conversations(subject, last_preview, last_sender, last_message_at, email_mailbox)').in('booking_id', ids),
      supabase.from('booking_documents').select('id, booking_id, file_name, storage_path, created_at, uploaded_via').in('booking_id', ids).order('created_at', { ascending: false }),
      supabase.from('tms_consignments').select('id, booking_id, consignment_no, status, order_type, wms_checkin_at, picked_up_at, created_at').in('booking_id', ids).order('created_at', { ascending: false }),
    ]).then(([th, dc, tj]) => {
      if (!live) return
      const threads = ((th.data ?? []) as unknown as { booking_id: string; conversation_id: string; inbox_conversations: Omit<ThreadRow, 'conversation_id'> | null }[])
        .filter((t) => t.inbox_conversations)
        .map((t) => ({ conversation_id: t.conversation_id, ...t.inbox_conversations!, from: label.get(t.booking_id) }))
      const docs = ((dc.data ?? []) as (DocRow & { booking_id: string })[]).map((d) => ({ ...d, from: label.get(d.booking_id) }))
      const tms = new Map<string, TmsJob>()
      for (const t of (tj.data ?? []) as (TmsJob & { booking_id: string })[]) if (!tms.has(t.booking_id)) tms.set(t.booking_id, t)
      setX({ threads, docs, tms })
    })
    return () => { live = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return x
}
