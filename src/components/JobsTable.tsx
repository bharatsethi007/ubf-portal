import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import type { Shipment } from '../types/shipment'
import { fmtShort } from '../utils/format'
import { applyShipmentQueryFilters, getSortColumn, pageRange, PAGE_SIZE } from '../utils/shipmentQuery'
import { useShipmentFilters } from '../hooks/useShipmentFilters'
import { useShipmentQueryContext } from '../hooks/useShipmentQueryContext'
import Pagination from './Pagination'
import StatusPill from './StatusPill'

const SELECT = `
  job_unique, job_no, house_bill, origin, destination,
  etd, eta, status, vessel_flight,
  customers ( name )
`

const SELECT_CUSTOMER_FILTER = `
  job_unique, job_no, house_bill, origin, destination,
  etd, eta, status, vessel_flight,
  customers!inner ( name )
`

function etdEtaCell(etd: string | null, eta: string | null): string {
  const e = fmtShort(etd)
  const a = fmtShort(eta)
  if (e === '—' && a === '—') return '—'
  return `${e} / ${a}`
}

export default function JobsTable() {
  const { page, setPage } = useShipmentFilters()
  const queryCtx = useShipmentQueryContext()
  const [rows, setRows] = useState<Shipment[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    ;(async () => {
      const { from, to } = pageRange(page)
      const customer = queryCtx.filters.customer.trim()
      const needsCustomerJoin = customer.length > 0 && !/^\d+$/.test(customer)
      const sortCol = getSortColumn(queryCtx.view, queryCtx.dateBasis)
      let query = supabase
        .from('shipments')
        .select(needsCustomerJoin ? SELECT_CUSTOMER_FILTER : SELECT, { count: 'exact' })
        .order(sortCol, { ascending: false, nullsFirst: false })
      query = applyShipmentQueryFilters(query, queryCtx)
      const { data, error: err, count } = await query.range(from, to)

      if (cancelled) return
      if (err) {
        setError(err.message)
        setRows([])
        setTotal(0)
      } else {
        setError('')
        setRows((data as Shipment[]) ?? [])
        setTotal(count ?? 0)
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [queryCtx, page])

  if (error) return <div className="error card pad-inline">{error}</div>

  return (
    <div className="shipments-table card">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Job No.</th>
              <th>House Bill</th>
              <th>Customer</th>
              <th>Origin → Dest</th>
              <th>Vessel/Flight</th>
              <th>ETD/ETA</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="muted pad-inline">Loading jobs…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="muted pad-inline">No jobs match your filters.</td></tr>
            ) : (
              rows.map((s) => (
                <tr key={s.job_unique}>
                  <td className="mono">
                    <Link to={`/shipments/${s.job_unique}`} className="link">
                      {s.job_no ?? s.job_unique}
                    </Link>
                  </td>
                  <td className="mono">{s.house_bill ?? '—'}</td>
                  <td>{s.customers?.name ?? '—'}</td>
                  <td className="mono">{s.origin ?? '—'} → {s.destination ?? '—'}</td>
                  <td>{s.vessel_flight ?? '—'}</td>
                  <td className="mono">{etdEtaCell(s.etd, s.eta)}</td>
                  <td><StatusPill status={s.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  )
}
