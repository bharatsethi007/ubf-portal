import { useCallback, useEffect, useState } from 'react'
import { Plus, X, Send, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchRateRequestContext, buildRateRequestEmail,
  saveRateRequestDraft, sendRateRequest, fetchRateRequests,
  type RateRequestContext, type Recipient, type RateRequestSummary,
} from './rateRequestApi'
import AgentRecipientPicker from './AgentRecipientPicker'

const SRC_STYLE: Record<Recipient['source'], { bg: string; color: string; label: string }> = {
  agent: { bg: '#EEF1FB', color: '#0A2472', label: 'Agent' },
  customer: { bg: '#F0F1F5', color: '#555', label: 'Customer' },
  manual: { bg: '#FCEFD6', color: '#B4791F', label: 'Manual' },
}

function fmtWhen(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function QuoteRequestRates({ quoteId }: { quoteId: string }) {
  const [ctx, setCtx] = useState<RateRequestContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<RateRequestSummary[]>([])

  const loadHistory = useCallback(async () => {
    try { setHistory(await fetchRateRequests(quoteId)) } catch { /* ignore */ }
  }, [quoteId])

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr('')
    fetchRateRequestContext(quoteId)
      .then((c) => { if (cancelled) return; setCtx(c); const e = buildRateRequestEmail(c); setSubject(e.subject); setBody(e.body) })
      .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [quoteId])

  useEffect(() => { loadHistory() }, [loadHistory])

  async function handleSaveDraft() {
    if (!ctx) return
    setSaving(true)
    try {
      await saveRateRequestDraft(ctx, subject, body, recipients)
      toast.success('Draft saved')
      await loadHistory()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  async function handleSend() {
    if (!ctx) return
    if (recipients.length === 0) { toast.error('Add at least one recipient'); return }
    if (!subject.trim()) { toast.error('Subject is empty'); return }
    setSending(true)
    try {
      const { requestId } = await saveRateRequestDraft(ctx, subject, body, recipients)
      const res = await sendRateRequest(requestId)
      if (res.ok) {
        toast.success(`Sent to ${res.sent} recipient${res.sent === 1 ? '' : 's'}${res.failed.length ? `, ${res.failed.length} failed` : ''}`)
        res.failed.forEach((f) => toast.error(`${f.email}: ${f.error}`))
        setRecipients([])
      } else {
        toast.error(res.failed[0] ? `Send failed: ${res.failed[0].error}` : 'Send failed')
      }
      await loadHistory()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed')
      await loadHistory()
    } finally { setSending(false) }
  }

  if (loading) return <p className="qr-placeholder">Preparing rate request…</p>
  if (err) return <p className="qr-placeholder" style={{ color: '#B23B3B' }}>{err}</p>
  if (!ctx) return null
  if (!ctx.polCode || !ctx.podCode) return <p className="qr-placeholder">Set an origin and destination port on this quote to draft a rate request.</p>
  if (!ctx.movement || !ctx.incoterm) return <p className="qr-placeholder">Set the movement (import/export) and incoterm on this quote so we can work out which charges to request.</p>

  const askChips: string[] = []
  if (ctx.requestFreight) askChips.push('Freight')
  if (ctx.requestLocal) askChips.push(ctx.agentEnd === 'origin' ? 'Origin local' : 'Destination local')
  const busy = saving || sending

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0A2472' }}>{ctx.polCode} → {ctx.podCode}</span>
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{ctx.modeLabel} · {ctx.incoterm} · {ctx.movement === 'export' ? 'Export' : 'Import'}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, alignItems: 'center' }}>
        <span style={{ color: 'var(--muted-foreground)' }}>
          Requesting from agent at {ctx.agentEnd === 'origin' ? 'origin' : 'destination'} ({ctx.agentCountry ?? '—'}):
        </span>
        {askChips.length ? askChips.map((c) => (
          <span key={c} style={{ background: '#EEF1FB', color: '#0A2472', borderRadius: 999, padding: '2px 10px', fontWeight: 600 }}>{c}</span>
        )) : <span style={{ color: '#B4791F' }}>No agent charges needed for this incoterm — UBF prices this lane locally.</span>}
      </div>
      {ctx.ruleNote && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>{ctx.ruleNote}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Recipients ({recipients.length})</span>
          <button className="btn" onClick={() => setPickerOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12 }}>
            <Plus size={14} /> Add recipients
          </button>
        </div>
        {recipients.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>No recipients yet — pick agents, search the customer database, or add an email manually.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {recipients.map((r) => {
              const s = SRC_STYLE[r.source]
              return (
                <span key={r.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #E3E5EC', borderRadius: 8, padding: '4px 8px', fontSize: 12 }}>
                  <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: '1px 7px', fontSize: 10, fontWeight: 600 }}>{s.label}</span>
                  <span>{r.name ? `${r.name} · ` : ''}{r.email}</span>
                  <button onClick={() => setRecipients((xs) => xs.filter((x) => x.key !== r.key))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', display: 'inline-flex', padding: 0 }} aria-label="Remove">
                    <X size={13} />
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
        <span style={{ color: 'var(--muted-foreground)' }}>Subject</span>
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
        <span style={{ color: 'var(--muted-foreground)' }}>Email body</span>
        <textarea className="input" style={{ minHeight: 260, fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.5 }} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn" onClick={handleSaveDraft} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13 }}>
          <Save size={14} /> {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button className="btn" onClick={handleSend} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 13, background: '#0A2472', color: '#fff', opacity: busy ? 0.6 : 1 }}>
          <Send size={14} /> {sending ? 'Sending…' : 'Send request'}
        </button>
      </div>

      {history.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Request history</span>
          {history.map((h) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, border: '1px solid #EEF0F4', borderRadius: 8, padding: '6px 10px' }}>
              <span style={{ background: h.status === 'sent' ? '#E6F4EC' : '#F0F1F5', color: h.status === 'sent' ? '#1F8A4C' : '#555', borderRadius: 999, padding: '1px 8px', fontSize: 10, fontWeight: 600, textTransform: 'capitalize' }}>{h.status}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.subject ?? '(no subject)'}</span>
              <span style={{ color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{h.recipientCount} recipient{h.recipientCount === 1 ? '' : 's'}</span>
              <span style={{ color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{fmtWhen(h.sentAt ?? h.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      {pickerOpen && (
        <AgentRecipientPicker
          agentCountry={ctx.agentCountry}
          agentEnd={ctx.agentEnd}
          existing={recipients}
          onAdd={(r) => setRecipients((xs) => [...xs, r])}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
