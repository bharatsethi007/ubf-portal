import { useMemo, useState } from 'react'
import { Check, EyeOff, ReceiptText, RotateCcw, Wrench } from 'lucide-react'
import Pagination from '@/components/Pagination'
import { C, Card, KpiRail, Seg, Th, Td } from '../reportsUi'
import { fetchLeaks, reviewLeak, type LeakCategory, type LeakRow } from './financeApi'
import { compact, money } from './financeUtil'
import { ErrorBox, Loading, Pill, Toggle, useAsync } from './finUi'

const PAGE = 25
const CATS: { k: LeakCategory; label: string; tone: string; help: string; amt: (r: LeakRow) => number }[] = [
  { k: 'not_invoiced', label: 'Not invoiced', tone: 'bad', amt: (r) => r.cost_billed,
    help: 'Suppliers have billed this job but the customer has never been invoiced. Invoice it, or confirm it is a cancelled or internal job.' },
  { k: 'overrun', label: 'Cost overrun', tone: 'bad', amt: (r) => r.gap,
    help: 'Suppliers billed more than the cost booked when the customer was invoiced. Rebill the customer for the extra, or accept the lower margin.' },
  { k: 'loss', label: 'Loss-making', tone: 'warn', amt: (r) => -r.gp,
    help: 'Customer revenue is below what suppliers charged. Check pricing, missing charges, or wrong job allocation.' },
  { k: 'never_costed', label: 'Never costed', tone: 'warn', amt: (r) => r.cost_billed,
    help: 'Customer invoiced over 30 days ago and supplier bills received, but the job was never costed (no profit posted). Its margin is overstated in the P&L until costed.' },
  { k: 'cost_not_billed', label: 'Cost not billed', tone: 'info', amt: (r) => -r.gap,
    help: 'Cost booked at invoicing but the supplier has not billed it after 60 days. Chase the supplier bill, or release the accrual if it will never come.' },
]
const STATUS_LABEL: Record<string, string> = { rebilled: 'Rebilled', accepted: 'Accepted', fixed: 'Fixed in TradeWindow', ignore: 'Ignored' }
const ib = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 28, padding: 0 }

export default function FinLeaks() {
  const [tick, setTick] = useState(0)
  const q = useAsync(fetchLeaks, [tick])
  const [cat, setCat] = useState<LeakCategory>('not_invoiced')
  const [showReviewed, setShowReviewed] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const meta = CATS.find((c) => c.k === cat)!

  const v = useMemo(() => {
    const all = q.data ?? []
    const open = all.filter((r) => !r.review_status)
    const kpi = CATS.map((c) => {
      const rs = open.filter((r) => r.category === c.k)
      return { ...c, n: rs.length, total: rs.reduce((a, r) => a + c.amt(r), 0) }
    })
    const rows = all.filter((r) => r.category === cat && (showReviewed || !r.review_status))
      .filter((r) => !search || `${r.job_no} ${r.ref_job ?? ''} ${r.house_bill ?? ''} ${r.customer ?? ''} ${r.suppliers ?? ''}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => meta.amt(b) - meta.amt(a))
    return { kpi, rows }
  }, [q.data, cat, showReviewed, search, meta])

  async function act(r: LeakRow, s: 'rebilled' | 'accepted' | 'fixed' | 'ignore' | 'clear') {
    setBusy(r.job_no); setErr(null)
    try { await reviewLeak(r, s); setTick((t) => t + 1) } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }

  if (q.loading && !q.data) return <Loading />
  if (q.error) return <ErrorBox msg={q.error} />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <KpiRail items={v.kpi.map((k) => ({ label: k.label, value: compact(k.total), sub: `${k.n} jobs`, accent: k.tone === 'bad' ? C.red : k.tone === 'warn' ? '#F7941D' : C.faint }))} />
      {err && <ErrorBox msg={err} />}
      <Card pad={0}>
        <div style={{ padding: '14px 16px 6px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Seg options={CATS.map((c) => ({ k: c.k, label: c.label }))} value={cat} onChange={(k) => { setCat(k as LeakCategory); setPage(1) }} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Toggle on={showReviewed} onChange={setShowReviewed} label="Show reviewed" />
            <input className="input" placeholder="Job, bill, customer, supplier" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ width: 220 }} />
          </div>
        </div>
        <div style={{ padding: '4px 16px 10px', fontSize: 12.5, color: C.ink2 }}>{meta.help}</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><Th>Job</Th><Th>Customer</Th><Th>Suppliers</Th><Th right>Revenue</Th><Th right>Cost booked</Th><Th right>Supplier billed</Th>
              <Th right>{cat === 'cost_not_billed' ? 'Not billed' : 'Gap'}</Th><Th right>GP</Th><Th>Dates</Th><Th right> </Th></tr></thead>
            <tbody>
              {v.rows.slice((page - 1) * PAGE, page * PAGE).map((r) => (
                <tr key={`${r.job_no}-${r.category}`} style={{ borderTop: `1px solid ${C.line}`, opacity: r.review_status ? 0.55 : 1 }}>
                  <Td><span style={{ fontWeight: 600 }}>{r.module ?? 'Misc'} {r.job_no}</span>
                    <div style={{ fontSize: 11, color: C.mut }}>{r.house_bill ?? 'no house bill'}</div></Td>
                  <Td>{r.customer ?? <span style={{ color: C.mut }}>{r.customer_id ?? 'not linked'}</span>}</Td>
                  <Td muted>{r.suppliers ?? '–'}</Td>
                  <Td right>{r.revenue ? money(r.revenue) : '–'}</Td>
                  <Td right>{money(r.cost_booked)}</Td>
                  <Td right>{money(r.cost_billed)}</Td>
                  <Td right strong>{money(Math.abs(r.gap))}</Td>
                  <Td right><span style={{ color: r.gp < 0 ? C.red : C.ink }}>{money(r.gp)}</span>{r.margin != null && <div style={{ fontSize: 11, color: C.mut }}>{r.margin}%</div>}</Td>
                  <Td muted><div style={{ fontSize: 11.5 }}>Bill {r.first_bill ?? '–'}{r.last_bill && r.last_bill !== r.first_bill ? ` to ${r.last_bill}` : ''}</div>
                    <div style={{ fontSize: 11.5 }}>Invoiced {r.last_invoice ?? 'never'}</div></Td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {r.review_status ? (
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <Pill tone="low">{STATUS_LABEL[r.review_status]}</Pill>
                        <button className="icon-btn" style={ib} title="Undo" aria-label="Undo" disabled={busy === r.job_no} onClick={() => act(r, 'clear')}><RotateCcw size={14} /></button>
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        {(cat === 'overrun' || cat === 'not_invoiced' || cat === 'loss') &&
                          <button className="icon-btn" style={ib} title="Rebilled / invoiced customer" aria-label="Rebilled" disabled={busy === r.job_no} onClick={() => act(r, 'rebilled')}><ReceiptText size={14} /></button>}
                        <button className="icon-btn" style={ib} title="Fixed in TradeWindow" aria-label="Fixed" disabled={busy === r.job_no} onClick={() => act(r, 'fixed')}><Wrench size={14} /></button>
                        <button className="icon-btn" style={ib} title="Accept as is" aria-label="Accept" disabled={busy === r.job_no} onClick={() => act(r, 'accepted')}><Check size={15} /></button>
                        <button className="icon-btn" style={ib} title="Ignore" aria-label="Ignore" disabled={busy === r.job_no} onClick={() => act(r, 'ignore')}><EyeOff size={14} /></button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '8px 16px 14px' }}><Pagination page={page} total={v.rows.length} pageSize={PAGE} onPageChange={setPage} /></div>
      </Card>
      <div style={{ fontSize: 11.5, color: C.mut, lineHeight: 1.6 }}>
        Built from Accruals (23000) per job since 1 Apr 2025: cost booked = cost posted when the customer was invoiced, supplier billed = supplier
        invoices less credit notes. Revenue is the job's customer invoices excluding GST (disbursements included, since duty paid runs through
        the same account). Jobs invoiced in the last 3 weeks are skipped while the month closes. A review hides the job until its numbers change.
      </div>
    </div>
  )
}
