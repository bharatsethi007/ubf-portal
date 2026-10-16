import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Copy, Link2, Mail, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '../../../supabase'
import { fmtLong } from './AgreementPdfParts'
import { OFFICES, missingFields, type Agreement } from './agreementModel'

type Props = { a: Agreement; open: boolean; onOpenChange: (o: boolean) => void; onSent: () => void }

const emailOf = (s: string | undefined | null) => (s ?? '').replace(/.*·\s*/, '').trim()

function defaultMessage(a: Agreement, signer: string | null): string {
  const first = (a.signatory_name ?? '').split(/\s+/)[0] || 'there'
  const offices = OFFICES.filter((o) => a.offices.includes(o.code)).map((o) => o.country)
  const list = offices.length > 1 ? `${offices.slice(0, -1).join(', ')} and ${offices[offices.length - 1]}` : offices[0] ?? ''
  const missing = missingFields(a).length
  return [
    `Hi ${first},`,
    `Please find our Agency Co-operation Agreement covering UB Freight's ${list} offices. It runs from ${fmtLong(a.effective_date)} to ${fmtLong(a.expiry_date)}.`,
    `Most details are already filled in from our records.${missing ? ' Please check them and complete the highlighted fields.' : ' Please check them.'} Then sign online. It takes about three minutes.`,
    `Kind regards,\n${signer ?? 'UB Freight'}\nUB Freight Ltd`,
  ].join('\n\n')
}

/** Staff: email the signing link from salessupport, or create a link to paste into an ongoing thread. */
export default function SendAgreementDialog({ a, open, onOpenChange, onSent }: Props) {
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [days, setDays] = useState(14)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'email' | 'link'>('email')
  const [link, setLink] = useState('')

  useEffect(() => {
    if (!open) return
    setLink('')
    setTo(a.signatory_email ?? '')
    const ccs = [emailOf(a.agent_contacts?.operational)].filter((e) => e && e !== a.signatory_email)
    setCc([...new Set(ccs)].join(', '))
    setSubject(`UB Freight agency agreement for signature · ${a.agent_legal_name ?? ''}`.trim())
    setMessage(defaultMessage(a, a.ubf_signer_name))
  }, [open, a])

  async function send() {
    setBusy(true)
    try {
      const split = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean)
      const { data, error } = await supabase.functions.invoke('agreement-sign', {
        body: { op: 'send', id: a.id, to: split(to), cc: split(cc), subject, message, expires_days: days },
      })
      const err = (data as { error?: string } | null)?.error ?? (error ? await readErr(error) : null)
      if (err) throw new Error(err)
      toast.success(`Sent to ${split(to).join(', ')}`)
      onOpenChange(false)
      onSent()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setBusy(false)
    }
  }

  async function createLink() {
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('agreement-sign', { body: { op: 'create_link', id: a.id, expires_days: days } })
      const err = (data as { error?: string } | null)?.error ?? (error ? await readErr(error) : null)
      if (err) throw new Error(err)
      const url = (data as { link: string }).link
      setLink(url)
      await copy(url)
      onSent()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create link')
    } finally {
      setBusy(false)
    }
  }

  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); toast.success('Signing link copied') } catch { toast.message('Select the link and copy it') }
  }

  const lbl = 'text-[11.5px] text-[#5B6474]'
  const tab = (on: boolean) => `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] ${on ? 'bg-white text-[#0A2472] shadow-sm' : 'text-[#5B6474]'}`
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Share agreement for signature</DialogTitle>
          <p className="m-0 text-[12px] text-[#5B6474]">{a.agent_legal_name} · {a.ref} · {fmtLong(a.effective_date)} to {fmtLong(a.expiry_date)}</p>
        </DialogHeader>
        <div className="flex w-fit gap-1 rounded-lg bg-[#F1F3F7] p-1" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'email'} className={tab(mode === 'email')} onClick={() => setMode('email')}><Mail size={14} /> Email</button>
          <button type="button" role="tab" aria-selected={mode === 'link'} className={tab(mode === 'link')} onClick={() => setMode('link')}><Link2 size={14} /> Copy link</button>
        </div>
        {mode === 'link' ? (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-[13px] text-[#334155]">Create a signing link to paste into an email thread you already have with the agent. Nothing is emailed from the portal. You sign for UB Freight when the link is created.</p>
            <label className="flex items-center gap-2 whitespace-nowrap text-[12.5px]">Link expires in
              <select className="input input--sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[7, 14, 30].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
            </label>
            {link && (
              <div className="flex items-center gap-2 rounded-lg border border-[#E6E8EE] bg-[#F8FAFC] p-2">
                <input className="input flex-1 font-mono text-[12px]" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                <Button type="button" variant="outline" onClick={() => void copy(link)}><Copy size={14} /> Copy</Button>
              </div>
            )}
            <p className="m-0 text-[11.5px] text-[#5B6474]">A new link replaces any earlier link for this agreement.</p>
          </div>
        ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1"><span className={lbl}>To</span><input className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className={lbl}>Cc</span><input className="input" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Optional" /></label>
          <label className="flex flex-col gap-1"><span className={lbl}>Subject</span><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className={lbl}>Message (a "Review and sign" button is added below it)</span>
            <textarea className="input" rows={12} style={{ height: 260, minHeight: 200, resize: 'vertical', lineHeight: '20px', paddingTop: 10, paddingBottom: 10 }} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 whitespace-nowrap text-[12.5px]">Link expires in
              <select className="input input--sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[7, 14, 30].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
            </label>
            <span className="text-[11.5px] text-[#5B6474]">Sent from salessupport.nz@ubfreight.com, replies come to you. You sign for UB Freight on send.</span>
          </div>
        </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{link ? 'Done' : 'Cancel'}</Button>
          {mode === 'email'
            ? <Button type="button" disabled={busy || !to.trim()} onClick={() => void send()}><Send size={14} /> {busy ? 'Sending…' : 'Send for signature'}</Button>
            : <Button type="button" disabled={busy} onClick={() => void createLink()}><Link2 size={14} /> {busy ? 'Creating…' : link ? 'Create new link' : 'Create and copy link'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

async function readErr(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    try { const j = await ctx.json(); if (j?.error) return String(j.error) } catch { /* ignore */ }
  }
  return error instanceof Error ? error.message : 'Send failed'
}
