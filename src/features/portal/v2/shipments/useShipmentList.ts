import { useEffect, useState } from 'react'
import { supabase } from '../../../../supabase'
import type { HomeShipment } from '../usePortalHome'
import type { ListShipment, Range } from './shipmentList'

const COLS = `job_unique, module, job_no, house_bill, shipment_no, master_bill, pack_qty, pack_type, mode, direction, origin, destination,
  vessel_flight, etd, eta, departed, arrived, doc_date, consignee_name, shipper_name, customer_ref,
  goods_desc, load_type, weight_kg, volume_m3, status, stage, is_active, consol_key`

const since = (r: Range): string | null => {
  if (r === 'all') return null
  const d = new Date()
  d.setDate(d.getDate() - (r === '90d' ? 90 : 365))
  return d.toISOString().slice(0, 10)
}

/** Shipments for the list page, with container numbers joined in by consol. */
export function useShipmentList(range: Range) {
  const [rows, setRows] = useState<ListShipment[]>([])
  const [pending, setPending] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    void (async () => {
      let q = supabase.from('portal_shipments').select(COLS).order('doc_date', { ascending: false }).limit(3000)
      const from = since(range)
      if (from) q = q.gte('doc_date', from)
      const [{ data, error: e }, bk] = await Promise.all([
        q,
        supabase.from('portal_bookings').select('id', { count: 'exact', head: true }).in('portal_status', ['requested', 'confirmed']),
      ])
      if (!alive) return
      if (e) { setError('Shipments could not load. Refresh to try again.'); setLoading(false); return }
      const ships = (data ?? []) as (HomeShipment & { consol_key: string | null })[]

      const keys = [...new Set(ships.map((s) => s.consol_key).filter(Boolean))] as string[]
      const boxes = new Map<string, string[]>()
      for (let i = 0; i < keys.length; i += 200) {
        const { data: cs } = await supabase.from('portal_containers').select('consol_key, c_number').in('consol_key', keys.slice(i, i + 200))
        for (const c of (cs ?? []) as { consol_key: string; c_number: string | null }[]) {
          if (!c.c_number) continue
          const list = boxes.get(c.consol_key) ?? []
          const no = c.c_number.replace(/\s/g, '').toUpperCase()
          if (!list.includes(no)) list.push(no)
          boxes.set(c.consol_key, list)
        }
      }
      if (!alive) return
      setRows(ships.map((s) => ({ ...s, containers: (s.consol_key && boxes.get(s.consol_key)) || [] })))
      setPending(bk.count ?? 0)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [range])

  return { rows, pending, loading, error }
}
