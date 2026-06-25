import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Invoice } from '../types/invoice'
import { invoiceStatus } from '../types/invoice'
import { fmtMoney, fmtShort } from '../utils/format'

type Props = {
  invoices: Invoice[]
  loading?: boolean
  emptyMessage?: string
  showShipment?: boolean
  outstandingByCurrency?: Record<string, number>
  paginate?: boolean
  pageSize?: number
  defaultShowPaid?: boolean
}

export default function InvoicesTable({
  invoices,
  loading,
  emptyMessage = 'No invoices.',
  showShipment = false,
  outstandingByCurrency,
  paginate = false,
  pageSize = 25,
  defaultShowPaid = false,
}: Props) {
  const [showPaid, setShowPaid] = useState(defaultShowPaid)
  const [page, setPage] = useState(0)

  const outstanding = outstandingByCurrency
    ? Object.entries(outstandingByCurrency).filter(([, v]) => v > 0)
    : []

  const filtered = useMemo(
    () => (showPaid ? invoices : invoices.filter((inv) => invoiceStatus(inv) !== 'Paid')),
    [invoices, showPaid],
  )

  useEffect(() => {
    setPage(0)
  }, [showPaid, invoices])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const visible = paginate
    ? filtered.slice(page * pageSize, page * pageSize + pageSize)
    : filtered
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = paginate ? Math.min(total, page * pageSize + pageSize) : total

  return (
    <>
      {outstanding.length > 0 && (
        <div className="invoice-outstanding">
          {outstanding.map(([cur, amt]) => (
            <span key={cur} className="pill transit invoice-outstanding__badge">
              Outstanding: {fmtMoney(amt, cur === '—' ? null : cur)}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <p className="muted pad-inline">Loading invoices…</p>
      ) : invoices.length === 0 ? (
        <p className="muted pad-inline">{emptyMessage}</p>
      ) : (
        <>
          <label className="invoice-table__toggle check-row">
            <input
              type="checkbox"
              checked={showPaid}
              onChange={(e) => setShowPaid(e.target.checked)}
            />
            Show paid
          </label>

          {filtered.length === 0 ? (
            <p className="muted pad-inline">No invoices match this filter.</p>
          ) : (
            <>
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Type</th>
                    {showShipment && <th>Shipment</th>}
                    <th>Date</th>
                    <th>Due</th>
                    <th>Total</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((inv) => (
                    <tr key={inv.invoice_no}>
                      <td className="mono nums">{inv.invoice_no}</td>
                      <td>{inv.doctype ?? '—'}</td>
                      {showShipment && (
                        <td>
                          {inv.job_unique != null
                            ? <Link to={`/shipments/${inv.job_unique}`}>{inv.job_unique}</Link>
                            : '—'}
                        </td>
                      )}
                      <td className="mono nums">{fmtShort(inv.doc_date)}</td>
                      <td className="mono nums">{fmtShort(inv.date_due)}</td>
                      <td className="mono nums">{fmtMoney(inv.amt_local, inv.currency)}</td>
                      <td className="mono nums">{fmtMoney(inv.balance, inv.currency)}</td>
                      <td><InvoiceStatusPill status={invoiceStatus(inv)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {paginate && (
                <div className="pagination">
                  <span className="pagination__info muted">
                    Showing {from}–{to} of {total}
                  </span>
                  <div className="pagination__controls">
                    <button
                      type="button"
                      className="pagination__btn"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      className="pagination__btn"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  )
}

function InvoiceStatusPill({ status }: { status: ReturnType<typeof invoiceStatus> }) {
  const cls =
    status === 'Paid' ? 'pill arrived'
    : status === 'Part-paid' ? 'pill transit'
    : 'pill unpaid'
  return <span className={cls}>{status}</span>
}
