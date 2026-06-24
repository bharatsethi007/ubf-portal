import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Shipment } from '../types/shipment'
import { fmtShort } from '../utils/format'
import { useShipmentFilters } from '../hooks/useShipmentFilters'
import StatusPill from './StatusPill'

const SELECT = `
  job_unique, job_no, house_bill, origin, destination, direction,
  etd, eta, relevant_date, status,
  customers ( name )
`

type Props = { consolKey: string }

export default function ConsolJobsPanel({ consolKey }: Props) {
  const { openJobDrawer } = useShipmentFilters()
  const [rows, setRows] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .from('shipments')
      .select(SELECT)
      .eq('consol_key', consolKey)
      .order('relevant_date', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setRows((data as Shipment[]) ?? [])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [consolKey])

  if (loading) return <div className="consol-jobs muted">Loading jobs…</div>
  if (rows.length === 0) return <div className="consol-jobs muted">No jobs in this consol.</div>

  return (
    <div className="consol-jobs">
      <table className="data-table data-table--compact">
        <thead>
          <tr>
            <th>Job No.</th>
            <th>Client</th>
            <th>Route</th>
            <th>Relevant date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr
              key={s.job_unique}
              className="row-clickable"
              onClick={() => openJobDrawer(s.job_unique, consolKey)}
            >
              <td className="mono">{s.job_no ?? s.house_bill ?? s.job_unique}</td>
              <td>{s.customers?.name ?? '—'}</td>
              <td className="mono">{s.origin ?? '—'} → {s.destination ?? '—'}</td>
              <td className="mono">{fmtShort(s.relevant_date)}</td>
              <td><StatusPill status={s.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
