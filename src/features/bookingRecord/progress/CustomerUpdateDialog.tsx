import { useEffect, useMemo, useState } from 'react'
import { Mail, MessageCircle, MonitorSmartphone, Send, Plus, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { fetchCustomerContacts, sendCustomerUpdate, type BookingProgress, type CustomerContacts, type SendResult } from './progressApi'
import { buildTemplate, relevantTemplates, type TemplateKey } from './messageTemplates'

export type Channel = 'email' | 'whatsapp' | 'portal'

type Props = {
  channel?: Channel
  open: boolean; onClose: () => void; progress: BookingProgress
  initialTemplate: TemplateKey; containers: string[]; vessel: string | null
  onSent?: () => void
}

const firstName = (s: string | null | undefined) => (s ?? '').trim().split(/\s+/)[0] || 'there'

export default function CustomerUpdateDialog({ channel, open, onClose, progress, initialTemplate, containers, vessel, onSent }: Props) {
  const [contacts, setContacts] = useState<CustomerContacts | null>(null)
  const [tpl, setTpl] = useState<TemplateKey>(initialTemplate)
  const [title, setTitle] = useState(''), [subject, setSubject] = useState(''), [body, setBody] = useState('')
  const [emails, setEmails] = useState<Set<string>>(new Set()), [extra, setExtra] = useState('')
  const [wa, setWa] = useState<Set<string>>(new Set()), [portal, setPortal] = useState(false)
  const [busy, setBusy] = useState(false), [results, setResults] = useState<SendResult[] | null>(null)

  useEffect(() => {
    if (!open) return
    setTpl(initialTemplate); setResults(null)
    fetchCustomerContacts(progress.booking_id).then((c) => {
      setContacts(c)
      const first = c?.emails[0]?.email
      const waFirst = c?.whatsapp[0]?.id
      const onPortal = Boolean(c && c.portal_users > 0)
      // Icon clicked decides the starting channel; default is email plus portal when available.
      setEmails(new Set(first && (!channel || channel === 'email') ? [first] : []))
      setWa(new Set(waFirst && channel === 'whatsapp' ? [waFirst] : []))
      setPortal(onPortal && (!channel || channel === 'portal'))
    }).catch(() => setContacts(null))
  }, [open, progress.booking_id, initialTemplate, channel])

  const greetName = useMemo(() => {
    const picked = contacts?.emails.find((e) => emails.has(e.email))
    return firstName(picked?.name || contacts?.customer_name)
  }, [contacts, emails])

  useEffect(() => {
    if (!open) return
    const t = buildTemplate(tpl, { p: progress, firstName: greetName, containers, vessel })
    setTitle(t.title); setSubject(t.subject); setBody(t.body)
  }, [tpl, open, progress, greetName, containers, vessel])

  const options = useMemo(() => relevantTemplates(progress), [progress])
  const category = buildTemplate(tpl, { p: progress, firstName: '', containers, vessel }).category
  const isRequest = buildTemplate(tpl, { p: progress, firstName: '', containers, vessel }).kind === 'request'
  const channels = emails.size + wa.size + (portal ? 1 : 0)

  function toggle(set: Set<string>, v: string, apply: (s: Set<string>) => void) {
    const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); apply(n)
  }
  function addExtra() {
    const e = extra.trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error('Not a valid email'); return }
    setEmails(new Set([...emails, e])); setExtra('')
  }

  async function send() {
    setBusy(true); setResults(null)
    try {
      const r = await sendCustomerUpdate({
        booking_id: progress.booking_id, subject, title, body, category,
        ...(emails.size ? { email: { to: [...emails] } } : {}),
        ...(wa.size ? { whatsapp: { contact_ids: [...wa] } } : {}),
        ...(portal ? { portal: true } : {}),
      })
      setResults(r.results)
      if (r.results.every((x) => x.ok)) { toast.success('Customer updated'); onSent?.(); window.setTimeout(onClose, 900) }
      else if (r.ok) onSent?.()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Send failed') } finally { setBusy(false) }
  }

  const extraEmails = [...emails].filter((e) => !contacts?.emails.some((c) => c.email === e))

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden rounded-2xl">
        <div className="cu-head">
          <DialogTitle className="cu-title">Update customer · <span className="mono">{progress.ref}</span></DialogTitle>
          <div className="cu-sub">{[contacts?.customer_name, isRequest ? 'Asks the customer to act' : null].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="cu-body">
          <div className="cu-tpls">
            {options.map((k) => {
              const t = buildTemplate(k, { p: progress, firstName: '', containers, vessel })
              return <button key={k} type="button" className={`cu-tpl${k === tpl ? ' cu-tpl--on' : ''}${t.kind === 'request' ? ' cu-tpl--req' : ''}`} onClick={() => setTpl(k)}>{t.label}</button>
            })}
          </div>
          <div className="cu-grid">
            <div className="cu-compose">
              <label className="cu-l">Subject</label>
              <input className="input input--sm" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <label className="cu-l">Heading</label>
              <input className="input input--sm" value={title} onChange={(e) => setTitle(e.target.value)} />
              <label className="cu-l">Message</label>
              <textarea className="input cu-text" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="cu-to">
              <div className="cu-ch"><Mail size={14} /> Email</div>
              {(contacts?.emails ?? []).map((c) => (
                <label key={c.email} className="cu-opt"><input type="checkbox" checked={emails.has(c.email)} onChange={() => toggle(emails, c.email, setEmails)} />
                  <span className="cu-opt__t">{c.name || c.email.split('@')[0]}<span className="cu-opt__s">{c.email} · {c.source}</span></span></label>
              ))}
              {extraEmails.map((e) => (
                <label key={e} className="cu-opt"><input type="checkbox" checked onChange={() => toggle(emails, e, setEmails)} /><span className="cu-opt__t">{e}</span></label>
              ))}
              <div className="cu-add">
                <input className="input input--sm" placeholder="Add email" value={extra} onChange={(e) => setExtra(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addExtra() }} />
                <button type="button" className="cu-ib" title="Add email" aria-label="Add email" onClick={addExtra}><Plus size={14} /></button>
              </div>

              <div className="cu-ch"><MessageCircle size={14} /> WhatsApp</div>
              {contacts?.whatsapp.length ? contacts.whatsapp.map((w) => (
                <label key={w.id} className="cu-opt"><input type="checkbox" checked={wa.has(w.id)} onChange={() => toggle(wa, w.id, setWa)} />
                  <span className="cu-opt__t">{w.name}<span className="cu-opt__s">{w.number} · opted in</span></span></label>
              )) : <div className="cu-none">No one at this customer has turned on WhatsApp in the portal.</div>}

              <div className="cu-ch"><MonitorSmartphone size={14} /> Customer portal</div>
              {contacts && contacts.portal_users > 0 ? (
                <label className="cu-opt"><input type="checkbox" checked={portal} onChange={() => setPortal(!portal)} />
                  <span className="cu-opt__t">Post to booking thread<span className="cu-opt__s">{contacts.portal_users} portal user{contacts.portal_users === 1 ? '' : 's'}, they reply in the portal</span></span></label>
              ) : <div className="cu-none">Customer isn't on the portal yet.</div>}
            </div>
          </div>
          {results && (
            <div className="cu-results">
              {results.map((r, i) => (
                <div key={i} className={`cu-res ${r.ok ? 'cu-res--ok' : 'cu-res--bad'}`}>{r.ok ? <Check size={13} /> : <X size={13} />} {r.channel}: {r.detail}</div>
              ))}
            </div>
          )}
        </div>
        <div className="cu-foot">
          <span className="cu-foot__s">Replies go to {contacts?.reply_to ?? 'you'}. Logged in booking comms.</span>
          <button type="button" className="cu-send" disabled={busy || !channels || !body.trim()} onClick={send} title="Send" aria-label="Send">
            <Send size={15} /> {busy ? 'Sending' : `Send${channels ? ` (${channels})` : ''}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
