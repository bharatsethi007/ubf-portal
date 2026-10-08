import { useState } from 'react'
import { Send } from 'lucide-react'
import { C, glass } from '../reportsUi'
import { sendReminder, type CustomerLedger, type QueueRow } from './financeApi'
import { reminderTemplate } from './collectionsTemplates'
import { moneyD } from './financeUtil'
import { Banner, ErrorBox } from './finUi'

const split = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean)

export default function FinReminderCompose({ row, ledger, invoices, total, onClose, onSent }: {
  row: QueueRow; ledger: CustomerLedger; invoices: string[]; total: number; onClose: () => void; onSent: () => void
}) {
  const t = reminderTemplate(row.stage, ledger.name ?? row.accountid, moneyD(total))
  const [to, setTo] = useState(ledger.best_email ?? '')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState(t.subject)
  const [text, setText] = useState(t.text)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function send() {
    setBusy(true); setErr(null)
    try {
      const r = await sendReminder({ accountid: row.accountid, to: split(to), cc: split(cc), subject, text, invoices })
      setDone(`Sent from ${r.from}. Logged in history.`)
      setTimeout(onSent, 900)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const label = { fontSize: 11.5, color: C.ink2, marginBottom: 4 }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.35)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...glass, background: '#fff', width: 'min(680px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Payment reminder: {ledger.name ?? row.accountid}</div>
        <div style={{ fontSize: 12, color: C.mut, marginBottom: 14 }}>
          From {ledger.mailbox ?? 'accounts.nz@ubfreight.com'} · {invoices.length} invoice{invoices.length === 1 ? '' : 's'} totalling {moneyD(total)} are listed under your message.
        </div>
        {row.is_related && <div style={{ marginBottom: 12 }}><Banner tone="warn">This is a related company. Usually settled by intercompany arrangement, not a reminder.</Banner></div>}
        {row.unapplied < 0 && <div style={{ marginBottom: 12 }}><Banner tone="warn">This customer has {moneyD(-row.unapplied)} of unapplied payments. Match them first so the reminder is accurate.</Banner></div>}
        <div style={{ display: 'grid', gap: 10 }}>
          <div><div style={label}>To</div>
            <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="accounts@customer.co.nz" />
            {ledger.emails.length > 1 && <div style={{ fontSize: 11.5, color: C.mut, marginTop: 4 }}>On file: {ledger.emails.join(', ')}</div>}
          </div>
          <div><div style={label}>Cc</div><input className="input" value={cc} onChange={(e) => setCc(e.target.value)} /></div>
          <div><div style={label}>Subject</div><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div><div style={label}>Message</div><textarea className="input" rows={11} value={text} onChange={(e) => setText(e.target.value)} /></div>
        </div>
        {err && <div style={{ marginTop: 10 }}><ErrorBox msg={err} /></div>}
        {done && <div style={{ marginTop: 10 }}><Banner tone="good">{done}</Banner></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <button className="text-link" onClick={onClose}>Cancel</button>
          <button className="btn btn--inline" title="Send through Outlook" aria-label="Send through Outlook" disabled={busy || !!done || !split(to).length}
            onClick={send} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'auto', height: 34, padding: '0 14px' }}>
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
