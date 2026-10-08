import { useMemo, useState } from 'react'
import { Check, EyeOff, RotateCcw } from 'lucide-react'
import Pagination from '@/components/Pagination'
import { C, Card, KpiRail, NAVY, Seg, Th, Td } from '../reportsUi'
import { fetchMatches, reviewMatch, type MatchRow } from './financeApi'
import { compact, money } from './financeUtil'
import { ErrorBox, Loading, Pill, Toggle, useAsync } from './finUi'

type Conf = 'all' | 'high' | 'medium' | 'low' | 'none'
const PAGE = 25
const CONF_TONE: Record<string, string> = { high: 'good', medium: 'warn', low: 'low', none: 'bad' }
const CONF_LABEL: Record<string, string> = { high: 'Exact', medium: 'Likely', low: 'Partial', none: 'No invoices' }
const btn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 28, padding: 0 }

export default function FinMatching() {
  const [tick, setTick] = useState(0)
  const q = useAsync(fetchMatches, [tick])
  const [conf, setConf] = useState<Conf>('all')
  const [showReviewed, setShowReviewed] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const v = useMemo(() => {
    const all = q.data ?? []
    const open = all.filter((r) => !r.review_status)
    const rows = all
      .filter((r) => showReviewed || !r.review_status)
      .filter((r) => conf === 'all' || r.confidence === conf)
      .filter((r) => !search || `${r.accountid} ${r.name ?? ''} ${r.ref ?? ''}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.balance - a.balance)
    const sum = (rs: MatchRow[]) => rs.reduce((a, r) => a + r.balance, 0)
    return {
      rows, total: sum(open), n: open.length,
      high: open.filter((r) => r.confidence === 'high'), none: open.filter((r) => r.confidence === 'none'),
      old: open.filter((r) => r.age_days > 90), done: all.filter((r) => r.review_status === 'done').length,
    }
  }, [q.data, conf, showReviewed, search])

  async function act(r: MatchRow, s: 'done' | 'ignore' | 'clear') {
    setBusy(r.receipt_id); setErr(null)
    try { await reviewMatch(r.receipt_id, s); setTick((t) => t + 1) } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }

  if (q.loading && !q.data) return <Loading />
  if (q.error) return <ErrorBox msg={q.error} />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <KpiRail items={[
        { label: 'Unmatched customer cash', value: compact(v.total), sub: `${v.n} receipts`, accent: NAVY },
        { label: 'Exact matches ready', value: compact(v.high.reduce((a, r) => a + r.balance, 0)), sub: `${v.high.length} receipts`, accent: C.green },
        { label: 'Credits with no open invoices', value: compact(v.none.reduce((a, r) => a + r.balance, 0)), sub: `${v.none.length} receipts: refund or apply`, accent: C.red },
        { label: 'Older than 90 days', value: compact(v.old.reduce((a, r) => a + r.balance, 0)), sub: `${v.old.length} receipts`, accent: C.faint },
        { label: 'Marked done', value: String(v.done), sub: 'clears after next sync', accent: C.faint },
      ]} />
      {err && <ErrorBox msg={err} />}
      <Card pad={0}>
        <div style={{ padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Seg options={[{ k: 'all', label: 'All' }, { k: 'high', label: 'Exact' }, { k: 'medium', label: 'Likely' }, { k: 'low', label: 'Partial' }, { k: 'none', label: 'No invoices' }]}
            value={conf} onChange={(k) => { setConf(k as Conf); setPage(1) }} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Toggle on={showReviewed} onChange={setShowReviewed} label="Show reviewed" />
            <input className="input" placeholder="Search customer or reference" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ width: 220 }} />
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><Th>Received</Th><Th>Customer</Th><Th>Reference</Th><Th right>Unapplied</Th><Th>Match</Th><Th>Suggested allocation</Th><Th right> </Th></tr></thead>
            <tbody>
              {v.rows.slice((page - 1) * PAGE, page * PAGE).map((r) => {
                const isOpen = expanded === r.receipt_id
                const invs = r.invoices ?? []
                const list = isOpen ? invs : invs.slice(0, 6)
                return (
                  <tr key={r.receipt_id} style={{ borderTop: `1px solid ${C.line}`, opacity: r.review_status ? 0.55 : 1, verticalAlign: 'top' }}>
                    <Td muted>{r.date1}<div style={{ fontSize: 11 }}>{r.age_days}d · #{r.receipt_no}</div></Td>
                    <Td><span style={{ fontWeight: 600 }}>{r.name ?? r.accountid}</span><div style={{ fontSize: 11, color: C.mut }}>{r.accountid}</div></Td>
                    <Td muted>{r.ref ?? '–'}</Td>
                    <Td right strong>{money(r.balance)}{r.balance !== r.amount && <div style={{ fontSize: 11, color: C.mut, fontWeight: 400 }}>of {money(r.amount)}</div>}</Td>
                    <Td><Pill tone={CONF_TONE[r.confidence]}>{CONF_LABEL[r.confidence]}</Pill></Td>
                    <td style={{ padding: '10px 12px', fontSize: 12.5, maxWidth: 460 }}>
                      <div style={{ color: C.ink2, marginBottom: 4 }}>{r.suggestion}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {list.map((i, k) => (
                          <span key={k} style={{ background: C.chip, borderRadius: 6, padding: '2px 6px', fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>
                            {i.accountid ? `${i.accountid} ` : ''}{i.number} · {money(i.balance)}
                          </span>
                        ))}
                        {invs.length > 6 && (
                          <button className="text-link" style={{ fontSize: 11.5 }} onClick={() => setExpanded(isOpen ? null : r.receipt_id)}>
                            {isOpen ? 'Show fewer' : `+${invs.length - 6} more`}
                          </button>
                        )}
                      </div>
                      {r.review_note && <div style={{ fontSize: 11.5, color: C.mut, marginTop: 4 }}>{r.review_note}</div>}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {r.review_status ? (
                        <button className="icon-btn" style={btn} title="Undo review" aria-label="Undo review" disabled={busy === r.receipt_id} onClick={() => act(r, 'clear')}><RotateCcw size={14} /></button>
                      ) : (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button className="icon-btn" style={btn} title="Done: allocated in TradeWindow" aria-label="Done" disabled={busy === r.receipt_id} onClick={() => act(r, 'done')}><Check size={15} /></button>
                          <button className="icon-btn" style={btn} title="Ignore" aria-label="Ignore" disabled={busy === r.receipt_id} onClick={() => act(r, 'ignore')}><EyeOff size={14} /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '8px 16px 14px' }}><Pagination page={page} total={v.rows.length} pageSize={PAGE} onPageChange={setPage} /></div>
      </Card>
      <div style={{ fontSize: 11.5, color: C.mut, lineHeight: 1.6 }}>
        Suggestions only: allocations are made in TradeWindow (Receipts &gt; allocate). Rules in order: same amount as one open invoice,
        oldest invoices that add up exactly, invoice number in the payment reference, same amount open on another customer (wrong account?),
        then oldest-first part allocation. Marking done hides a receipt until its balance changes.
      </div>
    </div>
  )
}
