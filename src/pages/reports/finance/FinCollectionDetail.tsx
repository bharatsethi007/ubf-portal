import { useMemo, useState } from 'react'
import { Mail, NotebookPen, X } from 'lucide-react'
import { C, Card } from '../reportsUi'
import { fetchLedger, logAction, type QueueRow } from './financeApi'
import { KIND_LABEL } from './collectionsTemplates'
import { compact, money } from './financeUtil'
import { ErrorBox, Loading, Pill, useAsync } from './finUi'
import FinReminderCompose from './FinReminderCompose'
import DateField from '@/components/DateField'

const iconBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'auto', height: 32, padding: '0 10px', gap: 6 }
const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: '2-digit' }) : '–')

export default function FinCollectionDetail({ row, onClose, onChanged }: { row: QueueRow; onClose: () => void; onChanged: () => void }) {
  const [tick, setTick] = useState(0)
  const q = useAsync(() => fetchLedger(row.accountid), [row.accountid, tick])
  const [sel, setSel] = useState<Set<string> | null>(null)
  const [compose, setCompose] = useState(false)
  const [kind, setKind] = useState('call')
  const [body, setBody] = useState('')
  const [pDate, setPDate] = useState('')
  const [pAmt, setPAmt] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const invs = q.data?.invoices ?? []
  const selected = useMemo(() => sel ?? new Set(invs.filter((i) => i.days_over > 0).map((i) => i.number)), [sel, invs])
  const toggle = (n: string) => { const s = new Set(selected); if (s.has(n)) s.delete(n); else s.add(n); setSel(s) }
  const selTotal = invs.filter((i) => selected.has(i.number)).reduce((a, i) => a + i.balance, 0)
  const refresh = () => { setTick((t) => t + 1); onChanged() }

  async function save() {
    setBusy(true); setErr(null)
    try {
      await logAction({ accountid: row.accountid, kind, body, promise_date: kind === 'promise' ? pDate || null : null,
        promise_amount: kind === 'promise' && pAmt ? Number(pAmt) : null, invoices: [...selected] })
      setBody(''); setPDate(''); setPAmt(''); refresh()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Card pad={0} style={{ position: 'sticky', top: 12 }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{row.name ?? row.accountid} {row.is_related && <Pill tone="info">related</Pill>}</div>
          <div style={{ fontSize: 12, color: C.mut, marginTop: 3 }}>
            {row.accountid} · {row.terms ?? 'terms n/a'} · {row.email ?? 'no email on file'}
          </div>
        </div>
        <button className="icon-btn" title="Close" aria-label="Close" onClick={onClose}><X size={16} /></button>
      </div>
      {q.loading ? <Loading /> : q.error ? <div style={{ padding: 14 }}><ErrorBox msg={q.error} /></div> : q.data && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 16, fontSize: 12.5, flexWrap: 'wrap' }}>
            <span>Overdue <b>{compact(row.overdue)}</b></span><span>Total <b>{compact(row.total)}</b></span>
            {row.unapplied < 0 && <span style={{ color: C.green }}>Unapplied cash <b>{compact(-row.unapplied)}</b></span>}
            {row.avg_days_late != null && <span>Usually pays <b>{row.avg_days_late}</b> days late</span>}
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto', border: `1px solid ${C.line}`, borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ color: C.mut, textAlign: 'left' }}>
                <th style={{ padding: 6 }} /><th style={{ padding: 6 }}>Invoice</th><th style={{ padding: 6 }}>Type</th><th style={{ padding: 6 }}>Due</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Days</th><th style={{ padding: 6, textAlign: 'right' }}>Balance</th></tr></thead>
              <tbody>{invs.map((i, k) => (
                <tr key={`${i.number}-${k}`} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={{ padding: 6 }}><input type="checkbox" checked={selected.has(i.number)} onChange={() => toggle(i.number)} /></td>
                  <td style={{ padding: 6 }}>{i.number}</td><td style={{ padding: 6, color: C.mut }}>{i.module} {i.doctype}</td>
                  <td style={{ padding: 6 }}>{fmtD(i.datedue)}</td>
                  <td style={{ padding: 6, textAlign: 'right', color: i.days_over > 30 ? C.red : C.ink }}>{i.days_over > 0 ? i.days_over : '–'}</td>
                  <td style={{ padding: 6, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(i.balance)}</td>
                </tr>))}</tbody>
            </table>
          </div>
          {q.data.unapplied.length > 0 && (
            <div style={{ fontSize: 12, color: C.ink2 }}>Unapplied receipts: {q.data.unapplied.map((u) => `${fmtD(u.date)} ${money(u.balance)}`).join(' · ')}.
              Match these in TradeWindow before chasing.</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: C.mut }}>{selected.size} selected · {money(selTotal)}</span>
            <button className="btn btn--inline" style={iconBtn} title="Email reminder" aria-label="Email reminder"
              disabled={!selected.size} onClick={() => setCompose(true)}><Mail size={15} /></button>
          </div>

          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="input" value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 160 }}>
                {['call', 'note', 'promise', 'dispute', 'hold'].map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
              {kind === 'promise' && <>
                <DateField value={pDate} onChange={(v: string) => setPDate(v ?? '')} width={150} placeholder="Pay by" />
                <input className="input" type="number" placeholder="Amount" value={pAmt} onChange={(e) => setPAmt(e.target.value)} style={{ width: 110 }} />
              </>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea className="input" rows={2} placeholder="What was said or agreed" value={body} onChange={(e) => setBody(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn--inline" style={{ ...iconBtn, alignSelf: 'flex-end' }} title="Save to history" aria-label="Save to history"
                disabled={busy || (!body.trim() && kind !== 'promise')} onClick={save}><NotebookPen size={15} /></button>
            </div>
            {err && <ErrorBox msg={err} />}
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: C.mut, marginBottom: 6 }}>History</div>
            {!q.data.actions.length && <div style={{ fontSize: 12, color: C.mut }}>Nothing logged yet.</div>}
            {q.data.actions.map((a) => (
              <div key={a.id} style={{ borderTop: `1px solid ${C.line}`, padding: '8px 0', fontSize: 12.5 }}>
                <div style={{ display: 'flex', gap: 8, color: C.mut, fontSize: 11.5 }}>
                  <span style={{ color: C.ink, fontWeight: 600 }}>{KIND_LABEL[a.kind] ?? a.kind}</span>
                  <span>{fmtD(a.at)}</span><span>{a.by ?? ''}</span>
                  {a.promise_date && <span>pay by {fmtD(a.promise_date)}{a.promise_amount ? ` · ${money(a.promise_amount)}` : ''}</span>}
                </div>
                {a.body && <div style={{ whiteSpace: 'pre-wrap', color: C.ink2, marginTop: 3, maxHeight: 80, overflow: 'hidden' }}>{a.body}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {compose && q.data && (
        <FinReminderCompose row={row} ledger={q.data} invoices={[...selected]} total={selTotal}
          onClose={() => setCompose(false)} onSent={() => { setCompose(false); refresh() }} />
      )}
    </Card>
  )
}
