import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Loader2, Plus, Trash2 } from 'lucide-react'
import { detailPath, fmtDay, fmtNum, titleCase } from '../homeModel'
import { HEALTH, allocate, fetchRecentShipments, setPoStatus, unallocate, type PoLine, type PoRow, type RecentShipment, type SupplyChain } from './productsApi'

type Props = { pos: PoRow[]; sc: SupplyChain; onChanged: () => void }

function AllocateForm({ line, ships, onSaved }: { line: PoLine; ships: RecentShipment[]; onSaved: () => void }) {
  const left = Math.max(0, line.qty_ordered - line.allocations.reduce((n, a) => n + a.qty, 0))
  const [job, setJob] = useState('')
  const [qty, setQty] = useState(String(left || ''))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function save() {
    if (!job || !(Number(qty) > 0)) { setErr('Pick a shipment and quantity'); return }
    setBusy(true); setErr('')
    try { await allocate(line.line_id, Number(job), Number(qty)); onSaved() } catch (e) { setErr(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }
  return (
    <div className="pv3-po__alloc">
      <select value={job} onChange={(e) => setJob(e.target.value)} aria-label="Shipment">
        <option value="">Add to shipment…</option>
        {ships.map((s) => <option key={s.job_unique} value={s.job_unique}>{s.label}</option>)}
      </select>
      <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantity" />
      <button type="button" className="pv3-btn pv3-btn--ghost" disabled={busy} onClick={() => void save()}>{busy ? <Loader2 size={14} className="pv3-spin" /> : <Plus size={14} />} Add</button>
      {err && <span className="pv3-form__err">{err}</span>}
    </div>
  )
}

/** Purchase orders with fulfilment progress; expand to see lines and put quantities on shipments. */
export default function PoList({ pos, sc, onChanged }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const [ships, setShips] = useState<RecentShipment[]>([])
  const shipNo = new Map(sc.shipments.map((s) => [s.job_unique, s.shipment_no]))
  useEffect(() => { if (open && !ships.length) void fetchRecentShipments().then(setShips) }, [open, ships.length])

  return (
    <div className="pv3-table-wrap">
      <table className="pv3-table">
        <thead><tr><th>PO</th><th>Supplier</th><th>Ordered</th><th>Cargo ready</th><th>Fulfilment</th><th>Shipments</th><th>Status</th><th aria-label="Expand" /></tr></thead>
        <tbody>
          {pos.map((p) => {
            const isOpen = open === p.po_id
            const shippedPct = p.ordered ? Math.min(100, Math.round((p.shipped / p.ordered) * 100)) : 0
            const arrivedPct = p.ordered ? Math.min(100, Math.round((p.arrived / p.ordered) * 100)) : 0
            const h = HEALTH[p.health]
            return (
              <Fragment key={p.po_id}>
                <tr onClick={() => setOpen(isOpen ? null : p.po_id)} className={isOpen ? 'pv3-row--open' : ''}>
                  <td><b className="pv3-mono pv3-strong">{p.po_number}</b><span className="pv3-cell-sub">{p.lines.length} SKU{p.lines.length === 1 ? '' : 's'} · {fmtNum(p.ordered)} units</span></td>
                  <td className="pv3-ellipsis">{titleCase(p.supplier) || '—'}</td>
                  <td>{fmtDay(p.order_date)}</td>
                  <td>{fmtDay(p.required_date)}</td>
                  <td>
                    <div className="pv3-po__bar" title={`${shippedPct}% shipped, ${arrivedPct}% arrived`}>
                      <span className="pv3-po__bar-ship" style={{ width: `${shippedPct}%` }} />
                      <span className="pv3-po__bar-arr" style={{ width: `${arrivedPct}%` }} />
                    </div>
                    <span className="pv3-cell-sub">{shippedPct}% shipped · {arrivedPct}% arrived</span>
                  </td>
                  <td>{p.jobs.length ? p.jobs.slice(0, 2).map((j) => <span key={j} className="pv3-po__chip pv3-mono">{shipNo.get(j) ?? `#${j}`}</span>) : <span className="pv3-cell-sub">None yet</span>}{p.jobs.length > 2 && <span className="pv3-cell-sub">+{p.jobs.length - 2}</span>}</td>
                  <td><span className={`pv3-tag pv3-tag--${h.tone}`}>{h.label}</span></td>
                  <td><ChevronDown size={16} className={`pv3-chev${isOpen ? ' pv3-chev--open' : ''}`} /></td>
                </tr>
                {isOpen && (
                  <tr className="pv3-row-detail"><td colSpan={8}>
                    <div className="pv3-po__detail">
                      {p.lines.map((l) => {
                        const alloc = l.allocations.reduce((n, a) => n + a.qty, 0)
                        return (
                          <div key={l.line_id} className="pv3-po__line">
                            <div className="pv3-po__sku">
                              <b className="pv3-mono">{l.sku}</b>
                              <span>{titleCase(l.description)}</span>
                              <span className="pv3-cell-sub">{fmtNum(alloc)} of {fmtNum(l.qty_ordered)} on shipments{l.unit_price != null ? ` · ${l.currency ?? ''} ${l.unit_price}/unit` : ''}</span>
                            </div>
                            <div className="pv3-po__allocs">
                              {l.allocations.map((a) => (
                                <span key={a.job_unique} className="pv3-po__a">
                                  <Link to={detailPath({ job_unique: a.job_unique })} className="pv3-mono">{shipNo.get(a.job_unique) ?? `#${a.job_unique}`}</Link>
                                  {fmtNum(a.qty)}{a.implicit ? ' (matched by PO ref)' : ''}
                                  {!a.implicit && <button type="button" aria-label="Remove" onClick={() => void unallocate(l.line_id, a.job_unique).then(onChanged)}><Trash2 size={12} /></button>}
                                </span>
                              ))}
                              {p.status === 'open' && alloc < l.qty_ordered && <AllocateForm line={l} ships={ships} onSaved={onChanged} />}
                            </div>
                          </div>
                        )
                      })}
                      <div className="pv3-po__actions">
                        {p.status === 'open'
                          ? <button type="button" className="pv3-textbtn" onClick={() => void setPoStatus(p.po_id, 'closed').then(onChanged)}>Mark PO complete</button>
                          : <button type="button" className="pv3-textbtn" onClick={() => void setPoStatus(p.po_id, 'open').then(onChanged)}>Reopen PO</button>}
                      </div>
                    </div>
                  </td></tr>
                )}
              </Fragment>
            )
          })}
          {!pos.length && <tr><td colSpan={8} className="pv3-empty-cell">No purchase orders yet. Upload them to track every SKU.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
