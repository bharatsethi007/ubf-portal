import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabase'
import type { AirConsol, EaRow } from './eaTypes'

export type EaDetail = EaRow & {
  shipper_address: string | null
  shipper_city: string | null
  consignee_address: string | null
  consignee_contact: string | null
  consignee_phone: string | null
  goods_description: string | null
  commodity: string | null
  cargo_value: number | null
  cargo_value_currency: string | null
  pickup_address: string | null
  incoterm: string | null
  account_id: string | null
  preferred_pickup_at: string | null
  picked_up_at: string | null
  wms_checkin_at: string | null
  sli_status: string | null
  sli_signed_at: string | null
  consol_mawb: string | null
  hold_code: string | null
}

export type CargoLine = { id: string; kind: 'booked' | 'actual'; pieces: number | null; weight: number | null; cbm: number | null }
export type ThreadRow = { conversation_id: string; subject: string | null; last_preview: string | null; last_sender: string | null; last_message_at: string | null; email_mailbox: string | null }
export type DocRow = { id: string; file_name: string; storage_path: string; created_at: string; uploaded_via: string | null }
export type TmsJob = { id: string; consignment_no: string | null; status: string | null; order_type: string | null; wms_checkin_at: string | null; picked_up_at: string | null }
export type HistRow = { id: number; field: string | null; action: string | null; new_value: string | null; actor_name: string | null; created_at: string }

export function useEaBooking(id: string | undefined) {
  const [b, setB] = useState<EaDetail | null>(null)
  const [lines, setLines] = useState<CargoLine[]>([])
  const [threads, setThreads] = useState<ThreadRow[]>([])
  const [docs, setDocs] = useState<DocRow[]>([])
  const [hist, setHist] = useState<HistRow[]>([])
  const [consols, setConsols] = useState<AirConsol[]>([])
  const [tms, setTms] = useState<TmsJob | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    const [bk, cl, th, dc, hs, tj] = await Promise.all([
      supabase.from('v_ea_bookings').select('*').eq('id', id).maybeSingle(),
      supabase.from('booking_cargo_lines').select('id, kind, pieces, weight, cbm').eq('booking_id', id),
      supabase.from('booking_threads')
        .select('conversation_id, inbox_conversations(subject, last_preview, last_sender, last_message_at, email_mailbox)')
        .eq('booking_id', id),
      supabase.from('booking_documents').select('id, file_name, storage_path, created_at, uploaded_via')
        .eq('booking_id', id).order('created_at', { ascending: false }),
      supabase.from('booking_history').select('id, field, action, new_value, actor_name, created_at')
        .eq('booking_id', id).order('created_at', { ascending: false }).limit(12),
      supabase.from('tms_consignments').select('id, consignment_no, status, order_type, wms_checkin_at, picked_up_at')
        .eq('booking_id', id).order('created_at', { ascending: false }).limit(1),
    ])
    if (bk.error || !bk.data) { setError(bk.error?.message ?? 'Booking not found'); return }
    const row = bk.data as EaDetail
    setB(row)
    setLines((cl.data ?? []) as CargoLine[])
    setThreads(((th.data ?? []) as unknown as { conversation_id: string; inbox_conversations: Omit<ThreadRow, 'conversation_id'> | null }[])
      .map((t) => ({ conversation_id: t.conversation_id, ...(t.inbox_conversations ?? { subject: null, last_preview: null, last_sender: null, last_message_at: null, email_mailbox: null }) }))
      .sort((a, c) => (c.last_message_at ?? '').localeCompare(a.last_message_at ?? '')))
    setDocs((dc.data ?? []) as DocRow[])
    setHist((hs.data ?? []) as HistRow[])
    setTms(((tj.data ?? [])[0] as TmsJob | undefined) ?? null)
    const cs = await supabase.from('v_air_consols').select('*')
      .eq('destination', (row.destination || 'NAN').toUpperCase())
      .not('status', 'in', '(departed,cancelled)')
      .gte('flight_date', new Date(Date.now() - 86_400_000).toISOString().slice(0, 10))
      .order('flight_date')
    setConsols((cs.data ?? []) as AirConsol[])
  }, [id])

  useEffect(() => { void load() }, [load])

  return { b, lines, threads, docs, hist, consols, tms, error, reload: load }
}

export async function patchBooking(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('bookings').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}
