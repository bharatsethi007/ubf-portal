import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, ArrowRight, Clock } from 'lucide-react'
import { DECLINE_REASONS, loadPublicQuote, money, nzDate, respondPublicQuote, type PublicQuote } from './quoteRespondApi'

type View = 'choose' | 'decline' | 'done'
const NAVY = '#0A2472'

// Customer lands here from a quote reminder email. Nothing changes until they click a button
// (email scanners open links, so GET must never accept or decline).
export default function QuoteRespondPage() {
  const { token = '' } = useParams()
  const [sp] = useSearchParams()
  const [q, setQ] = useState<PublicQuote | null>(null)
  const [err, setErr] = useState('')
  const [view, setView] = useState<View>(sp.get('a') === 'decline' ? 'decline' : 'choose')
  const [pick, setPick] = useState<string | null>(sp.get('r'))
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<'accepted' | 'declined' | null>(null)

  useEffect(() => {
    loadPublicQuote(token)
      .then((d) => {
        if (d.error) { setErr('This link is not valid.'); return }
        setQ(d)
        setPick((p) => p ?? d.options[0]?.id ?? null)
      })
      .catch(() => setErr('Could not load this quote. Try again shortly.'))
  }, [token])

  async function submit(decision: 'accept' | 'decline') {
    setBusy(true); setErr('')
    try {
      const value = DECLINE_REASONS.find((r) => r.value === reason)?.value ?? reason
      const res = await respondPublicQuote(token, decision, decision === 'accept'
        ? { responseId: pick, note: note.trim() || null }
        : { reason: value, note: note.trim() || null })
      setOutcome(res === 'accepted' ? 'accepted' : 'declined'); setView('done')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
    } finally { setBusy(false) }
  }

  const closed = q && !['open', 'published', 'sent'].includes(q.status)
  const expired = q?.expires_at && new Date(q.expires_at).getTime() < Date.now()
  const lane = q ? `${q.from_name ?? q.from_code ?? ''} to ${q.to_name ?? q.to_code ?? ''}` : ''

  return (
    <div className="min-h-screen bg-white px-4 py-10" style={{ fontFamily: 'Inter Variable, system-ui, sans-serif' }}>
      <div className="mx-auto w-full max-w-xl">
        <img src="/ub-freight-logo-ink.png" alt="UB Freight" className="mb-8 h-10 w-auto" />

        {!q && !err && <p className="text-sm text-slate-500">Loading your quote…</p>}
        {!q && err && <Msg icon={<XCircle size={22} color="#B91C1C" />} title={err} body="Reply to the email you received and we will help." />}

        {q && view === 'done' && (
          outcome === 'accepted'
            ? <Msg icon={<CheckCircle2 size={22} color="#047857" />} title="Thanks, quote accepted"
                body={`${q.owner_name ?? 'Our team'} will be in touch shortly to book it in.${q.owner_email ? ` You can also reach them at ${q.owner_email}.` : ''}`} />
            : <Msg icon={<CheckCircle2 size={22} color={NAVY} />} title="Thanks for letting us know"
                body="We have closed this quote. Feel free to come back to us any time for a fresh rate." />
        )}

        {q && view !== 'done' && closed && (
          <Msg icon={<CheckCircle2 size={22} color={NAVY} />}
            title={`Quote ${q.quote_no} is already ${q.status === 'won' || q.status === 'crosswin' ? 'accepted' : 'closed'}`}
            body={q.lost_reason === 'Auto expired' ? 'It expired. Reply to the email and we will refresh the rates.' : 'Nothing more to do. Reply to the email if anything has changed.'} />
        )}

        {q && view !== 'done' && !closed && expired && (
          <Msg icon={<Clock size={22} color="#B45309" />} title="This quote has expired" body="Reply to the email and we will refresh the rates for you." />
        )}

        {q && view !== 'done' && !closed && !expired && (
          <>
            <p className="text-xs uppercase tracking-wider" style={{ color: '#F7941D' }}>Quote {q.quote_no}</p>
            <h1 className="mt-1 text-2xl text-slate-900">{lane}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {[q.customer_name, q.type ?? q.mode, q.incoterms].filter(Boolean).join(' · ')}
              {q.expires_at ? ` · valid until ${nzDate(q.expires_at)}` : ''}
            </p>

            {view === 'choose' && (
              <>
                <div className="mt-6 flex flex-col gap-2">
                  {q.options.map((o, i) => (
                    <label key={o.id} className="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3"
                      style={{ borderColor: pick === o.id ? NAVY : '#E2E8F0', background: pick === o.id ? '#F5F7FC' : '#fff' }}>
                      <input type="radio" name="opt" checked={pick === o.id} onChange={() => setPick(o.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-slate-900">{o.carrier ?? o.product ?? (q.options.length > 1 ? `Option ${i + 1}` : 'Your rate')}</span>
                        <span className="block text-xs text-slate-500">
                          {[o.transit_days ? `${o.transit_days} days transit` : null, o.via ? `via ${o.via}` : null, o.product].filter(Boolean).join(' · ') || ' '}
                        </span>
                      </span>
                      <span className="text-sm tabular-nums text-slate-900">{money(o.total, o.currency)}</span>
                    </label>
                  ))}
                </div>
                <textarea className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows={2}
                  placeholder="Anything we should know? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button type="button" className="text-sm text-slate-500 underline" onClick={() => { setView('decline'); setErr('') }}>
                    Not going ahead?
                  </button>
                  <button type="button" disabled={!pick || busy} onClick={() => submit('accept')}
                    className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm text-white"
                    style={{ background: '#047857', opacity: !pick || busy ? 0.6 : 1 }}>
                    {busy ? 'Saving…' : 'Accept quote'} <ArrowRight size={16} />
                  </button>
                </div>
              </>
            )}

            {view === 'decline' && (
              <>
                <p className="mt-6 text-sm text-slate-700">Sorry this one did not work out. What was the main reason?</p>
                <div className="mt-3 flex flex-col gap-2">
                  {DECLINE_REASONS.map((r) => (
                    <label key={r.value} className="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-sm"
                      style={{ borderColor: reason === r.value ? NAVY : '#E2E8F0' }}>
                      <input type="radio" name="reason" checked={reason === r.value} onChange={() => setReason(r.value)} />
                      {r.label}
                    </label>
                  ))}
                </div>
                <textarea className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows={2}
                  placeholder={reason === 'Other' ? 'Please tell us why' : 'Anything else? e.g. the rate you were offered (optional)'}
                  value={note} onChange={(e) => setNote(e.target.value)} />
                {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button type="button" className="text-sm text-slate-500 underline" onClick={() => { setView('choose'); setErr('') }}>
                    Back to options
                  </button>
                  <button type="button" disabled={!reason || (reason === 'Other' && !note.trim()) || busy} onClick={() => submit('decline')}
                    className="rounded-lg px-5 py-2.5 text-sm text-white"
                    style={{ background: '#475569', opacity: !reason || busy ? 0.6 : 1 }}>
                    {busy ? 'Saving…' : 'Decline quote'}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        <p className="mt-12 text-xs text-slate-400">UB Freight Ltd · Auckland, New Zealand</p>
      </div>
    </div>
  )
}

function Msg({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-6 py-6">
      <div className="flex items-center gap-2">{icon}<h1 className="text-lg text-slate-900">{title}</h1></div>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
    </div>
  )
}
