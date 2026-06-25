import { Fragment, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../supabase'
import type { Consol } from '../types/consol'
import { fmtShort } from '../utils/format'
import { consolMasterBillLabel, tabMasterBillLabel } from '../utils/consolBill'
import { applyShipmentQueryFilters, getSortColumn, pageRange, PAGE_SIZE } from '../utils/shipmentQuery'
import { useConsolTracking } from '../hooks/useConsolTracking'
import { useShipmentFilters } from '../hooks/useShipmentFilters'
import { useShipmentQueryContext } from '../hooks/useShipmentQueryContext'
import { useStaff } from '../hooks/useStaff'
import ConsolJobsPanel from './ConsolJobsPanel'
import TrackingToggle from './shipments/TrackingToggle'
import Pagination from './Pagination'

export default function ConsolsTable() {
  const { page, setPage, activeModule } = useShipmentFilters()
  const queryCtx = useShipmentQueryContext()
  const { isStaff } = useStaff()
  const [rows, setRows] = useState<Consol[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [containerCounts, setContainerCounts] = useState<Record<string, number>>({})

  const consolKeys = useMemo(() => rows.map((r) => r.consol_key), [rows])
  const { map: trackingMap, refetch: refetchTracking } = useConsolTracking(consolKeys)

  useEffect(() => {
    setExpanded(null)
  }, [queryCtx])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    ;(async () => {
      const { from, to } = pageRange(page)
      const sortCol = getSortColumn(queryCtx.view, queryCtx.dateBasis)
      let query = supabase
        .from('v_consols')
        .select('*', { count: 'exact' })
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
        setRows((data as Consol[]) ?? [])
        setTotal(count ?? 0)
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [queryCtx, page])

  useEffect(() => {
    if (rows.length === 0) {
      setContainerCounts({})
      return
    }

    let cancelled = false
    const keys = rows.map((r) => r.consol_key)

    ;(async () => {
      const { data, error } = await supabase
        .from('containers')
        .select('consol_key')
        .in('consol_key', keys)

      if (cancelled) return

      const counts: Record<string, number> = {}
      for (const key of keys) counts[key] = 0
      if (!error && data) {
        for (const row of data as { consol_key: string }[]) {
          counts[row.consol_key] = (counts[row.consol_key] ?? 0) + 1
        }
      }
      setContainerCounts(counts)
    })()

    return () => {
      cancelled = true
    }
  }, [rows])

  if (error) return <div className="error card pad-inline">{error}</div>

  const billHeader = tabMasterBillLabel(activeModule)
  const colSpan = isStaff ? 11 : 10

  return (
    <div className="shipments-table card">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th className="col-expand" />
              <th>Consol No.</th>
              <th>Mode</th>
              <th>{billHeader}</th>
              <th>Origin → Dest</th>
              <th>Vessel/Flight</th>
              <th>ETD</th>
              <th>ETA</th>
              <th>Jobs</th>
              <th>Containers</th>
              {isStaff && <th>Live Tracking</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colSpan} className="muted pad-inline">Loading consols…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={colSpan} className="muted pad-inline">No consols match your filters.</td></tr>
            ) : (
              rows.map((row) => {
                const open = expanded === row.consol_key
                const rowBillLabel = consolMasterBillLabel(row.module, row.mode)
                return (
                  <Fragment key={row.consol_key}>
                    <tr
                      className="row-clickable"
                      onClick={() => setExpanded(open ? null : row.consol_key)}
                    >
                      <td>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                      <td className="mono">{row.consol_key}</td>
                      <td>{row.mode === 'air' ? 'Air' : 'Sea'}</td>
                      <td>
                        <span className="consol-bill">
                          <span className="consol-bill__kind muted">{rowBillLabel}</span>
                          <span className="mono">{row.master_bill ?? '—'}</span>
                        </span>
                      </td>
                      <td className="mono">{row.origin ?? '—'} → {row.destination ?? '—'}</td>
                      <td>{row.vessel_flight ?? '—'}</td>
                      <td className="mono">{fmtShort(row.etd)}</td>
                      <td className="mono">{fmtShort(row.eta)}</td>
                      <td>{row.job_count}</td>
                      <td>{containerCounts[row.consol_key] ? containerCounts[row.consol_key] : '—'}</td>
                      {isStaff && (
                        <td>
                          <TrackingToggle
                            consolKey={row.consol_key}
                            module={row.module}
                            layout="compact"
                            stopPropagation
                            trackingMap={trackingMap}
                            refetchTracking={refetchTracking}
                          />
                        </td>
                      )}
                    </tr>
                    {open && (
                      <tr className="consol-expand-row">
                        <td colSpan={colSpan}><ConsolJobsPanel consolKey={row.consol_key} /></td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  )
}
