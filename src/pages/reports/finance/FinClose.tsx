import { useMemo, useState } from 'react'
import { Check, CheckCheck, LockOpen, MessageSquareText, RotateCcw } from 'lucide-react'
import { C, Card, KpiRail, NAVY } from '../reportsUi'
import { fetchClose, reviewClose, signOffMonth, type CloseCheck } from './financeApi'
import { compact, monthLabel } from './financeUtil'
import { Banner, ErrorBox, Loading, Pill, useAsync } from './finUi'
import type { FinPeriod, View } from './FinanceTab'

const AREAS = ['Bank', 'Ledger', 'Jobs', 'Payables', 'Debtors', 'P&L review', 'Data']
const TONE: Record<string, string> = { pass: 'good', warn: 'warn', fail: 'bad' }
const LABEL: Record<string, string> = { pass: 'Pass', warn: 'Check', fail: 'Fail' }
const ib = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 28, padding: 0 }
const fmtAt = (d: string) => new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
const isClear = (c: CloseCheck) => c.status === 'pass' || !!c.review

export default function FinClose({ p, onOpen }: { p: FinPeriod; onOpen: (v: View) => void }) {
  const month = p.toMonth
  const [tick, setTick] = useState(0)
  const q = useAsync(() => fetchClose(month), [month, tick])
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [signNote, setSignNote] = useState('')

  const v = useMemo(() => {
    const cs = q.data?.checks ?? []
    return { cs, clear: cs.filter(isClear).length, fails: cs.filter((c) => c.status === 'fail' && !c.review).length,
      warns: cs.filter((c) => c.status === 'warn' && !c.review).length }
  }, [q.data])

  async function run(key: string, f: () => Promise<unknown>) {
    setBusy(key); setErr(null)
    try { await f(); setNoteFor(null); setNote(''); setTick((t) => t + 1) } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }

  if (q.loading && !q.data) return <Loading />
  if (q.error) return <ErrorBox msg={q.error} />
  const so = q.data?.signoff
  const mon = monthLabel(month)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {so ? (
        <Banner tone="good">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            {mon} signed off by {so.by ?? 'unknown'} on {fmtAt(so.at)}.{so.note ? ` ${so.note}` : ''}
            <button className="icon-btn" style={ib} title="Reopen month" aria-label="Reopen month" disabled={busy === 'sign'}
              onClick={() => run('sign', () => signOffMonth(month, false))}><LockOpen size={14} /></button>
          </span>
        </Banner>
      ) : null}
      <KpiRail items={[
        { label: `${mon} close`, value: `${v.clear} of ${v.cs.length}`, sub: 'checks passed or reviewed', accent: NAVY },
        { label: 'Failed, open', value: String(v.fails), sub: v.fails ? 'fix or accept with a note' : 'none', accent: C.red },
        { label: 'To check', value: String(v.warns), sub: 'review before sign-off', accent: '#F7941D' },
        { label: 'Status', value: so ? 'Signed off' : 'Open', sub: so ? `by ${so.by ?? 'unknown'}` : 'not signed off', accent: so ? C.green : C.faint },
      ]} />
      {err && <ErrorBox msg={err} />}

      {AREAS.map((area) => {
        const rows = v.cs.filter((c) => c.area === area)
        if (!rows.length) return null
        return (
          <Card key={area} pad={0}>
            <div style={{ padding: '12px 16px 6px', fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: C.mut }}>{area}</div>
            {rows.map((c) => (
              <div key={c.code} style={{ borderTop: `1px solid ${C.line}`, padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'flex-start', opacity: c.review ? 0.7 : 1 }}>
                <div style={{ width: 62, flex: '0 0 62px', paddingTop: 1 }}><Pill tone={TONE[c.status]}>{LABEL[c.status]}</Pill></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{c.title}</span>
                    {c.amount != null && c.status !== 'pass' && <span style={{ fontSize: 12.5, color: C.ink2 }}>{compact(c.amount)}</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 3, lineHeight: 1.5 }}>{c.detail}</div>
                  {c.status !== 'pass' && !c.review && c.action && (
                    <div style={{ fontSize: 12, color: C.mut, marginTop: 3 }}>
                      {c.action}{c.view && <> <button className="text-link" style={{ fontSize: 12 }} onClick={() => onOpen(c.view as View)}>Open</button></>}
                    </div>
                  )}
                  {c.review && (
                    <div style={{ fontSize: 12, color: C.green, marginTop: 4 }}>
                      {c.review.status === 'done' ? 'Done' : 'Accepted'} by {c.review.by ?? 'unknown'} on {fmtAt(c.review.at)}{c.review.note ? `: ${c.review.note}` : ''}
                    </div>
                  )}
                  {noteFor === c.code && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input className="input" autoFocus placeholder="Why this is acceptable this month" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1 }} />
                      <button className="icon-btn" style={ib} title="Save" aria-label="Save" disabled={!note.trim() || busy === c.code}
                        onClick={() => run(c.code, () => reviewClose(month, c.code, 'accepted', note))}><Check size={15} /></button>
                    </div>
                  )}
                </div>
                {c.status !== 'pass' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {c.review ? (
                      <button className="icon-btn" style={ib} title="Undo review" aria-label="Undo review" disabled={busy === c.code}
                        onClick={() => run(c.code, () => reviewClose(month, c.code, 'open'))}><RotateCcw size={14} /></button>
                    ) : (<>
                      <button className="icon-btn" style={ib} title="Mark done: fixed in TradeWindow" aria-label="Mark done" disabled={busy === c.code}
                        onClick={() => run(c.code, () => reviewClose(month, c.code, 'done'))}><Check size={15} /></button>
                      <button className="icon-btn" style={ib} title="Accept with a note" aria-label="Accept with a note"
                        onClick={() => { setNoteFor(noteFor === c.code ? null : c.code); setNote('') }}><MessageSquareText size={14} /></button>
                    </>)}
                  </div>
                )}
              </div>
            ))}
          </Card>
        )
      })}

      {!so && (
        <Card>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: C.ink2, flex: '1 1 260px' }}>
              {v.fails ? `${v.fails} failed checks must be fixed or accepted before ${mon} can be signed off.` : `Ready to sign off ${mon}. The board pack will show who signed it off.`}
            </div>
            <input className="input" placeholder="Sign-off note (optional)" value={signNote} onChange={(e) => setSignNote(e.target.value)} style={{ width: 280 }} />
            <button className="btn btn--inline" style={{ ...ib, width: 'auto', height: 32, padding: '0 10px' }} title={`Sign off ${mon}`} aria-label={`Sign off ${mon}`}
              disabled={!!v.fails || busy === 'sign'} onClick={() => run('sign', () => signOffMonth(month, true, signNote))}><CheckCheck size={16} /></button>
          </div>
        </Card>
      )}
      <div style={{ fontSize: 11.5, color: C.mut, lineHeight: 1.6 }}>
        Checks run on the synced TradeWindow ledger for {mon}. Ledger-agreement and open-item checks use balances at the last sync.
        Fix issues in TradeWindow and re-sync, or mark a check done or accepted with a note. Sign-off is recorded with your name and a snapshot of the checks.
      </div>
    </div>
  )
}
