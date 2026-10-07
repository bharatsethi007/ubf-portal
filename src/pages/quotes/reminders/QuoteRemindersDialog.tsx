import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { BellRing, X, Send, Check, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchReminderCandidates, sendQuoteReminders, daysLeft, emailBlock, emailWarn,
  type ReminderCandidate, type SendResult,
} from './quoteRemindersApi'

type Props = { open: boolean; onClose: () => void; portName: (code: string | null) => string; onSent?: () => void }
type Window = '7' | '14' | 'all'
const WINDOWS: { key: Window; label: string }[] = [
  { key: '7', label: '7 days' }, { key: '14', label: '14 days' }, { key: 'all', label: 'All open' },
]
const RECENT_MS = 3 * 86400000

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' }) : 'Never'
}

export default function QuoteRemindersDialog({ open, onClose, portName, onSent }: Props) {
  const [mine, setMine] = useState(true)
  const [win, setWin] = useState<Window>('14')
  const [rows, setRows] = useState<ReminderCandidate[]>([])
  const [emails, setEmails] = useState<Record<string, string>>({})
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<Record<string, SendResult>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchReminderCandidates(mine)
      setRows(data)
      setEmails(Object.fromEntries(data.map((r) => [r.id, r.email ?? ''])))
      setResults({})
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load quotes')
    } finally {
      setLoading(false)
    }
  }, [mine])

  useEffect(() => { if (open) void load() }, [open, load])

  const visible = useMemo(
    () => rows.filter((r) => win === 'all' || daysLeft(r.expires_at) <= Number(win)),
    [rows, win],
  )

  // Default pick: sendable, no warning, not reminded in the last 3 days.
  useEffect(() => {
    setPicked(new Set(visible.filter((r) =>
      r.options > 0 && !emailBlock(emails[r.id]) && !emailWarn(emails[r.id])
      && !(r.last_reminded_at && Date.now() - new Date(r.last_reminded_at).getTime() < RECENT_MS),
    ).map((r) => r.id)))
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const sendable = (r: ReminderCandidate) => r.options > 0 && !emailBlock(emails[r.id])
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allOn = visible.filter(sendable).every((r) => picked.has(r.id)) && visible.some(sendable)
  const toggleAll = () => setPicked(allOn ? new Set() : new Set(visible.filter(sendable).map((r) => r.id)))
  const chosen = visible.filter((r) => picked.has(r.id) && sendable(r))

  async function send() {
    if (!chosen.length) return
    if (!window.confirm(`Email ${chosen.length} customer${chosen.length === 1 ? '' : 's'} now?`)) return
    setSending(true)
    try {
      const res = await sendQuoteReminders(chosen.map((r) => ({ quote_id: r.id, email: emails[r.id]?.trim() || null })))
      setResults(Object.fromEntries(res.results.map((x) => [x.quote_id, x])))
      const failed = res.results.length - res.sent
      if (res.sent) toast.success(`Sent ${res.sent} reminder${res.sent === 1 ? '' : 's'} from ${res.from}`)
      if (failed) toast.error(`${failed} not sent. See rows.`)
      setPicked(new Set())
      setRows((rs) => rs.map((r) => (res.results.find((x) => x.quote_id === r.id && x.ok)
        ? { ...r, last_reminded_at: new Date().toISOString(), reminders: r.reminders + 1 } : r)))
      onSent?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const th = 'px-2 py-2 text-left text-[11px] font-normal uppercase tracking-wide text-slate-500 whitespace-nowrap'
  const td = 'px-2 py-2 whitespace-nowrap'

  return (
    <div style={overlay} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Quote reminders">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: '#EEF2FF', color: '#0A2472' }}>
              <BellRing size={17} strokeWidth={2} />
            </span>
            <div>
              <div className="text-base text-slate-900">Quote reminders</div>
              <div className="text-xs text-slate-500">Customer gets Accept / Decline links. Sent from Sales Support, quote owner in CC.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Seg value={mine ? 'mine' : 'all'} onChange={(v) => setMine(v === 'mine')} items={[{ key: 'mine', label: 'My quotes' }, { key: 'all', label: 'All quotes' }]} />
            <Seg value={win} onChange={(v) => setWin(v as Window)} items={WINDOWS} prefix="Expiring" />
            <button type="button" className="icon-btn" title="Close" aria-label="Close" onClick={onClose}><X size={17} strokeWidth={2} /></button>
          </div>
        </div>

        <div className="min-h-[220px] flex-1 overflow-auto px-5 py-2" style={{ opacity: loading ? 0.55 : 1 }}>
          {!visible.length ? (
            <p className="py-12 text-center text-sm text-slate-500">{loading ? 'Loading…' : 'No open priced quotes in this window.'}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={th}><input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Select all" /></th>
                  <th className={th}>Quote</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Lane</th>
                  {!mine && <th className={th}>Owner</th>}
                  <th className={th}>Send to</th>
                  <th className={`${th} text-right`}>Expires</th>
                  <th className={`${th} text-right`}>Reminded</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const left = daysLeft(r.expires_at)
                  const block = r.options === 0 ? 'No priced options' : emailBlock(emails[r.id])
                  const warn = emailWarn(emails[r.id])
                  const res = results[r.id]
                  return (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className={td}><input type="checkbox" disabled={!!block} checked={picked.has(r.id) && !block} onChange={() => toggle(r.id)} /></td>
                      <td className={`${td} text-slate-900`}>{r.quote_no}</td>
                      <td className={`${td} max-w-[200px] truncate`} title={r.customer_name ?? ''}>{r.customer_name}</td>
                      <td className={`${td} text-slate-600`}>{portName(r.from_port_code)} → {portName(r.to_port_code)}</td>
                      {!mine && <td className={`${td} text-slate-600`}>{r.owner_name ?? '—'}</td>}
                      <td className={td}>
                        <input
                          className="input input--sm"
                          style={{ width: 230, borderColor: block && r.options ? '#FCA5A5' : warn ? '#FCD34D' : undefined }}
                          value={emails[r.id] ?? ''}
                          placeholder="customer@email.com"
                          onChange={(e) => setEmails((m) => ({ ...m, [r.id]: e.target.value }))}
                        />
                        {(block || warn) && <div className="mt-0.5 text-[11px]" style={{ color: block ? '#B91C1C' : '#B45309' }}>{block ?? warn}</div>}
                      </td>
                      <td className={`${td} text-right tabular-nums`} style={{ color: left <= 3 ? '#B91C1C' : left <= 7 ? '#B45309' : '#475569' }}>
                        {left <= 0 ? 'Today' : `${left}d`}
                      </td>
                      <td className={`${td} text-right text-slate-600`}>{fmt(r.last_reminded_at)}{r.reminders > 1 ? ` (${r.reminders})` : ''}</td>
                      <td className={td}>
                        {res && (res.ok
                          ? <span title={`Sent to ${res.to}`} style={{ color: '#047857' }}><Check size={16} /></span>
                          : <span title={res.error} style={{ color: '#B91C1C' }}><AlertTriangle size={16} /></span>)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <span className="text-xs text-slate-500">{chosen.length} of {visible.length} selected. Quotes auto-close as lost 30 days after pricing.</span>
          <button
            type="button"
            className="btn btn--inline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: 'auto', opacity: chosen.length && !sending ? 1 : 0.5 }}
            disabled={!chosen.length || sending}
            onClick={send}
          >
            <Send size={15} strokeWidth={2} /> {sending ? 'Sending…' : `Send reminders (${chosen.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}

function Seg({ value, onChange, items, prefix }: { value: string; onChange: (v: string) => void; items: { key: string; label: string }[]; prefix?: string }) {
  return (
    <div className="inline-flex items-center rounded-md border border-slate-200 bg-white p-0.5" role="tablist">
      {prefix && <span className="px-1.5 text-[11px] text-slate-400">{prefix}</span>}
      {items.map((i) => (
        <button key={i.key} type="button" role="tab" aria-selected={value === i.key} onClick={() => onChange(i.key)}
          className={`rounded px-2.5 py-0.5 text-xs ${value === i.key ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>
          {i.label}
        </button>
      ))}
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
}
const sheet: CSSProperties = {
  background: '#fff', borderRadius: 12, width: 'min(1180px, 96vw)', maxHeight: '88vh',
  display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(15,23,42,0.25)', overflow: 'hidden',
}
