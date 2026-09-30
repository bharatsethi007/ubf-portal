import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, FileText, Loader2, Search, X } from 'lucide-react'
import { fmtDay, fmtMoney, todayIso } from '../homeModel'
import InvoiceDrawer from './InvoiceDrawer'
import { downloadStatementPdf } from './pdf/statementApi'
import {
  AGING, STATUS, aging, daysLate, docLabel, download, fetchBilling, inTab, money2, searchText, statusOf, summary, toCsv,
  type BillInvoice, type Tab,
} from './billingApi'
import '../shipments/shipments.css'
import './billing.css'

const PAGE = 25
const TABS: { key: Tab; label: string }[] = [
  { key: 'open', label: 'Open' }, { key: 'overdue', label: 'Overdue' }, { key: 'paid', label: 'Paid' }, { key: 'all', label: 'All' },
]

function Kpi({ label, value, sub, tone, delay }: { label: string; value: string; sub: ReactNode; tone?: 'red' | 'amber'; delay: number }) {
  return (
    <div className="pv3-card pv3-kpi pv3-rise" style={{ animationDelay: `${delay}s` }}>
      <span className="pv3-kpi__label">{label}</span>
      <span className={`pv3-kpi__value${tone ? ` pv3-kpi__value--${tone}` : ''}`}>{value}</span>
      <span className="pv3-kpi__sub">{sub}</span>
    </div>
  )
}

/** Billing: what's owed, what's overdue, every invoice with its charges, and CSV. */
export default function PortalBillingPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'open'
  const [rows, setRows] = useState<BillInvoice[] | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [stBusy, setStBusy] = useState(false)
  const picked = params.get('inv')
  const today = todayIso()

  useEffect(() => {
    let alive = true
    fetchBilling(24)
      .then((r) => { if (alive) setRows(r) })
      .catch((e) => { if (alive) setErr(e.message) })
    return () => { alive = false }
  }, [])

  const all = rows ?? []
  const sum = useMemo(() => summary(all, today), [all, today])
  const ag = useMemo(() => aging(all, today), [all, today])
  const agTotal = Object.values(ag).reduce((a, b) => a + b, 0)
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, all.filter((r) => inTab(r, t.key, today)).length])) as Record<Tab, number>, [all, today])
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = all.filter((r) => inTab(r, tab, today) && (!needle || searchText(r).includes(needle)))
    // Open views: oldest due first, so the next thing to pay is on top.
    return tab === 'open' || tab === 'overdue' ? [...list].sort((a, b) => a.date_due.localeCompare(b.date_due)) : list
  }, [all, tab, q, today])

  useEffect(() => { setPage(0) }, [tab, q])
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const slice = shown.slice(page * PAGE, page * PAGE + PAGE)
  const inv = picked ? all.find((r) => r.invoice_no === picked) ?? null : null

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params)
    if (v == null) p.delete(k); else p.set(k, v)
    setParams(p, { replace: k === 'tab' })
  }

  const curLine = sum.openByCur.length > 1 || (sum.openByCur[0] && sum.openByCur[0].currency !== 'NZD')
    ? sum.openByCur.map((c) => money2(c.amount, c.currency)).join(' + ')
    : `${sum.openCount} open invoice${sum.openCount === 1 ? '' : 's'}`

  return (
    <div className="pv3-page">
      <div className="pv3-head pv3-rise">
        <div>
          <h1>Billing</h1>
          <p>{rows ? `${sum.openCount} open invoice${sum.openCount === 1 ? '' : 's'}${sum.nextDue ? ` · next due ${fmtDay(sum.nextDue)}` : ''}` : 'Loading your invoices…'}</p>
        </div>
        <div className="pv3-head__actions">
          <button type="button" className="pv3-btn pv3-btn--primary" disabled={stBusy || !rows}
            onClick={() => { setStBusy(true); setErr(''); downloadStatementPdf().catch((e) => setErr(e instanceof Error ? e.message : 'Statement could not be made.')).finally(() => setStBusy(false)) }}>
            {stBusy ? <Loader2 size={15} className="pv3-spin" /> : <FileText size={15} />} Statement PDF
          </button>
          <button type="button" className="pv3-btn pv3-btn--ghost" disabled={!shown.length}
            onClick={() => download(`ub-freight-invoices-${today}.csv`, new Blob([toCsv(shown, today)], { type: 'text/csv;charset=utf-8' }))}>
            <Download size={15} /> Export
          </button>
        </div>
      </div>

      {err && <div className="pv3-error">{err}</div>}

      <div className="pv3-kpis pv3-bill__kpis">
        <Kpi label="Outstanding" value={rows ? fmtMoney(sum.openNzd, 'NZD') : '—'} sub={curLine} delay={0.02} />
        <Kpi label="Overdue" value={rows ? fmtMoney(sum.overdueNzd, 'NZD') : '—'} tone={sum.overdueNzd > 0 ? 'red' : undefined}
          sub={sum.overdueCount ? `${sum.overdueCount} invoice${sum.overdueCount === 1 ? '' : 's'} · oldest ${sum.oldestLate} days` : 'nothing overdue'} delay={0.05} />
        <Kpi label="Due in 14 days" value={rows ? fmtMoney(sum.soonNzd, 'NZD') : '—'} tone={sum.soonNzd > 0 ? 'amber' : undefined}
          sub={sum.soonCount ? `${sum.soonCount} invoice${sum.soonCount === 1 ? '' : 's'}` : 'nothing due soon'} delay={0.08} />
        <Kpi label="Invoiced, 12 months" value={rows ? fmtMoney(sum.billedNzd, 'NZD', true) : '—'} sub={`${sum.billedCount} invoices`} delay={0.11} />
      </div>

      {rows && agTotal > 0 && (
        <section className="pv3-card pv3-bill__aging pv3-rise" style={{ animationDelay: '.1s' }} aria-label="Balance by age">
          <header><h2>Balance by age</h2><span className="pv3-muted">NZD equivalent</span></header>
          <div className="pv3-bill__agbar">
            {AGING.map((a) => ag[a.key] > 0 && (
              <span key={a.key} style={{ width: `${(ag[a.key] / agTotal) * 100}%`, background: a.tone }} title={`${a.label}: ${fmtMoney(ag[a.key], 'NZD')}`} />
            ))}
          </div>
          <div className="pv3-bill__aglegend">
            {AGING.map((a) => (
              <div key={a.key} className={ag[a.key] > 0 ? '' : 'pv3-bill__agzero'}>
                <i style={{ background: a.tone }} />
                <span>{a.label}</span>
                <b>{fmtMoney(ag[a.key], 'NZD')}</b>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="pv3-sl__tabs pv3-rise" role="tablist" aria-label="Invoice status">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
            className={`pv3-sl__tab${tab === t.key ? ' pv3-sl__tab--on' : ''}${t.key === 'overdue' && counts.overdue ? ' pv3-sl__tab--warn' : ''}`}
            onClick={() => setParam('tab', t.key === 'open' ? null : t.key)}>
            {t.label}<span>{rows ? counts[t.key] : '·'}</span>
          </button>
        ))}
      </div>

      <section className="pv3-card pv3-sl pv3-rise" style={{ animationDelay: '.06s' }}>
        <div className="pv3-sl__bar">
          <label className="pv3-sl__search">
            <Search size={16} aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice, shipment, PO or supplier" aria-label="Search invoices" />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search"><X size={14} /></button>}
          </label>
        </div>

        <div className="pv3-table-wrap">
          <table className="pv3-table pv3-bill__table">
            <thead>
              <tr><th>Invoice</th><th>Shipment</th><th>Issued</th><th>Due</th><th className="pv3-num">Amount</th><th className="pv3-num">Balance</th><th>Status</th></tr>
            </thead>
            <tbody>
              {!rows && !err && [0, 1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={7}><span className="pv3-skel" /></td></tr>)}
              {slice.map((r) => {
                const st = statusOf(r, today)
                return (
                  <tr key={r.invoice_no} tabIndex={0} onClick={() => setParam('inv', r.invoice_no)} onKeyDown={(e) => { if (e.key === 'Enter') setParam('inv', r.invoice_no) }}>
                    <td><b className="pv3-mono pv3-strong">{r.invoice_no}</b><span className="pv3-cell-sub">{docLabel(r.doctype)}</span></td>
                    <td>
                      <span className="pv3-mono">{r.shipment_no ?? '—'}</span>
                      <span className="pv3-cell-sub pv3-bill__party">{r.customer_ref ?? r.party ?? ''}</span>
                    </td>
                    <td>{fmtDay(r.doc_date)}</td>
                    <td className={st === 'overdue' ? 'pv3-bill__red' : ''}>
                      {fmtDay(r.date_due)}
                      {st === 'overdue' && <span className="pv3-cell-sub pv3-bill__red">{daysLate(r, today)} days over</span>}
                    </td>
                    <td className="pv3-num">{money2(r.amount, r.currency)}</td>
                    <td className="pv3-num"><b>{st === 'paid' ? '—' : money2(r.due, r.currency)}</b></td>
                    <td><span className={`pv3-bill__st pv3-bill__st--${STATUS[st].tone}`}>{STATUS[st].label}</span></td>
                  </tr>
                )
              })}
              {rows && !slice.length && (
                <tr><td colSpan={7} className="pv3-empty-cell">
                  {q ? <>Nothing matches “{q}”. <button type="button" className="pv3-textbtn" onClick={() => setQ('')}>Clear search</button></>
                    : tab === 'overdue' ? 'Nothing overdue. Thank you.' : tab === 'open' ? 'All paid up. Nothing owing.' : 'No invoices in the last 24 months.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {shown.length > PAGE && (
          <footer className="pv3-sl__foot">
            <span>{page * PAGE + 1}–{Math.min(shown.length, page * PAGE + PAGE)} of {shown.length.toLocaleString('en-NZ')}</span>
            <div>
              <button type="button" className="pv3-iconbtn" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
              <span>{page + 1} / {pages}</span>
              <button type="button" className="pv3-iconbtn" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
            </div>
          </footer>
        )}
      </section>
      <p className="pv3-foot">Balances come from our accounts system. A recent payment can take a day to show here.</p>

      {inv && <InvoiceDrawer inv={inv} onClose={() => setParam('inv', null)} />}
    </div>
  )
}
