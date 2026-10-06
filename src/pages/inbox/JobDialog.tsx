// Job actions from a conversation: link it, save attachments to a job's documents, or update a job from the email.
import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import JobPicker from './JobPicker'
import JobUpdateReview from './JobUpdateReview'
import { fetchDocTags, linkJob, saveDocsToJob, type InboxDetail, type JobHit } from './inboxApi'
import { isInlineJunk, kb, type JobMode } from './EmailParts'

const TITLE: Record<JobMode, string> = { link: 'Link to job', docs: 'Save attachments to job', update: 'Update job from email' }
type Open = { mode: JobMode; attachmentIds?: number[]; messageId?: number }

export default function JobDialog({ detail, onChanged }: { detail: InboxDetail; onChanged: () => void }) {
  const [open, setOpen] = useState<Open | null>(null)
  const [job, setJob] = useState<JobHit | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [tags, setTags] = useState<{ id: string; name: string }[]>([])
  const [tag, setTag] = useState('')
  const [busy, setBusy] = useState(false)
  const convId = detail.conversation.id

  const atts = useMemo(() => detail.messages.flatMap((m) => (m.email?.attachments ?? []).filter((a) => !isInlineJunk(a))), [detail.messages])

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<Open>).detail
      if (!d?.mode) return
      setOpen(d); setJob(null); setTag('')
      setPicked(new Set(d.attachmentIds?.length ? d.attachmentIds : []))
    }
    window.addEventListener('ibx:job', on)
    return () => window.removeEventListener('ibx:job', on)
  }, [])
  useEffect(() => { if (open?.mode === 'docs' && !tags.length) void fetchDocTags().then(setTags).catch(() => {}) }, [open, tags.length])
  useEffect(() => { setOpen(null) }, [convId])

  if (!open) return null
  const close = () => setOpen(null)
  const done = (msg: string) => { toast.success(msg); close(); onChanged() }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try { await fn() } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }

  return (
    <div className="ibx-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="ibx-modal" role="dialog" aria-label={TITLE[open.mode]}>
        <header className="ibx-modal__head">
          <h3>{TITLE[open.mode]}</h3>
          <button type="button" className="ibx-mail__icon" aria-label="Close" onClick={close}><X size={18} /></button>
        </header>
        <div className="ibx-modal__body">
          {open.mode === 'docs' ? (
            <div style={{ marginBottom: 14 }}>
              <div className="ibx-modal__label">Files</div>
              {atts.length === 0 ? <div style={{ fontSize: 13, color: '#605E5C' }}>No attachments in this conversation.</div> : null}
              <div className="ibx-checks">
                {atts.map((a) => (
                  <label key={a.id}>
                    <input type="checkbox" checked={picked.has(a.id)} onChange={(e) => {
                      const n = new Set(picked); if (e.target.checked) n.add(a.id); else n.delete(a.id); setPicked(n)
                    }} />
                    <span className="ibx-ellip" style={{ flex: 1 }}>{a.name}</span><span style={{ color: '#605E5C', fontSize: 12 }}>{kb(a.size)}</span>
                  </label>
                ))}
              </div>
              <div className="ibx-modal__label" style={{ marginTop: 12 }}>Document type</div>
              <select className="ibx-select" style={{ width: '100%', height: 34 }} value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Document type">
                <option value="">Not set</option>
                {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div className="ibx-modal__label" style={{ marginTop: 12 }}>Job</div>
            </div>
          ) : null}

          {open.mode === 'update' && job ? (
            <JobUpdateReview convId={convId} job={job} messageId={open.messageId ?? null} onBack={() => setJob(null)}
              onDone={(msg) => done(msg)} />
          ) : (
            <JobPicker convId={convId} value={job} onPick={setJob} />
          )}
        </div>
        {open.mode !== 'update' ? (
          <footer className="ibx-modal__foot">
            <button type="button" className="ibx-btn" onClick={close}>Cancel</button>
            {open.mode === 'link' ? (
              <button type="button" className="ibx-btn ibx-btn--primary" disabled={!job || busy}
                onClick={() => job && void run(async () => { await linkJob(convId, job.id); done(`Linked to ${job.booking_ref}`) })}>
                {busy ? 'Linking…' : job ? `Link to ${job.booking_ref}` : 'Pick a job'}
              </button>
            ) : (
              <button type="button" className="ibx-btn ibx-btn--primary" disabled={!job || !picked.size || busy}
                onClick={() => job && void run(async () => {
                  const r = await saveDocsToJob(convId, job.id, [...picked], tag || null)
                  done(r.saved ? `Saved ${r.saved} file${r.saved > 1 ? 's' : ''} to ${r.booking_ref}${r.skipped ? ` (${r.skipped} already there)` : ''}`
                    : `Already on ${r.booking_ref}`)
                })}>
                {busy ? 'Saving…' : `Save ${picked.size || ''} file${picked.size === 1 ? '' : 's'}${job ? ` to ${job.booking_ref}` : ''}`}
              </button>
            )}
          </footer>
        ) : null}
      </div>
    </div>
  )
}
