// Update job from email: AI reads the email (staff click), shows field changes; staff tick and edit before applying.
import { useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { applyJobUpdate, proposeJobUpdate, type JobChange, type JobHit, type JobProposal } from './inboxApi'

type Props = { convId: string; job: JobHit; messageId: number | null; onBack: () => void; onDone: (msg: string) => void }
type Row = JobChange & { on: boolean; value: string }

const show = (v: string | number | null) => (v == null || v === '' ? 'Empty' : String(v))

export default function JobUpdateReview({ convId, job, messageId, onBack, onDone }: Props) {
  const [busy, setBusy] = useState<'read' | 'apply' | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [cntrs, setCntrs] = useState<(JobProposal['containers'][number] & { on: boolean })[]>([])

  async function read() {
    setBusy('read')
    try {
      const p = await proposeJobUpdate(convId, job.id, messageId)
      setRows(p.changes.map((c) => ({ ...c, on: !c.unsure, value: String(c.proposed) })))
      setCntrs(p.containers.map((c) => ({ ...c, on: true })))
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not read email') }
    finally { setBusy(null) }
  }

  async function apply() {
    if (!rows) return
    setBusy('apply')
    try {
      const changes = Object.fromEntries(rows.filter((r) => r.on && r.value.trim()).map((r) => [r.field, r.value.trim()]))
      const r = await applyJobUpdate(convId, job.id, changes, cntrs.filter((c) => c.on).map(({ no, type }) => ({ no, type })))
      onDone(`Updated ${r.booking_ref}: ${r.updated.join(', ')}`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Update failed') }
    finally { setBusy(null) }
  }

  const count = (rows?.filter((r) => r.on).length ?? 0) + cntrs.filter((c) => c.on).length
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs && rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13 }}>
        <span>Job</span><span className="ibx-mono" style={{ fontWeight: 500 }}>{job.booking_ref}</span>
        <span style={{ color: '#605E5C' }} className="ibx-ellip">{job.customer}</span>
        <button type="button" className="ibx-link" style={{ marginLeft: 'auto' }} onClick={onBack}>Change job</button>
      </div>

      {rows === null ? (
        <button type="button" className="ibx-opt" disabled={!!busy} onClick={() => void read()}>
          <span className="ibx-opt__icon" style={{ background: '#F3F6FF', color: '#1D4ED8' }}><Sparkles size={15} /></span>
          <span><span style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>{busy === 'read' ? 'Reading email and PDFs…' : 'Read email and suggest changes'}</span>
            <span style={{ display: 'block', fontSize: 12, color: '#605E5C' }}>Nothing changes until you apply. ~2c.</span></span>
        </button>
      ) : rows.length === 0 && cntrs.length === 0 ? (
        <div className="ibx-jobs__empty">Nothing new for {job.booking_ref} in this email.</div>
      ) : (
        <>
          <div className="ibx-diff">
            {rows.map((r, i) => (
              <label key={r.field} className="ibx-diff__row">
                <input type="checkbox" checked={r.on} onChange={(e) => set(i, { on: e.target.checked })} />
                <span className="ibx-diff__label">{r.label}{r.unsure ? <span className="ibx-chip ibx-chip--late" style={{ marginLeft: 6 }}>Check</span> : null}</span>
                <span className="ibx-diff__old ibx-ellip">{show(r.current)}</span>
                <ArrowRight size={13} color="#8A8886" style={{ flex: 'none' }} />
                <input className="ibx-diff__new" value={r.value} onChange={(e) => set(i, { value: e.target.value, on: true })} aria-label={`New ${r.label}`} />
              </label>
            ))}
            {cntrs.map((c, i) => (
              <label key={c.no} className="ibx-diff__row">
                <input type="checkbox" checked={c.on} onChange={(e) => setCntrs(cntrs.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} />
                <span className="ibx-diff__label">Add container</span>
                <span className="ibx-mono" style={{ flex: 1 }}>{c.no}{c.type ? ` · ${c.type}` : ''}</span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" className="ibx-btn ibx-btn--primary" disabled={!count || !!busy} onClick={() => void apply()}>
              {busy === 'apply' ? 'Updating…' : `Apply ${count} change${count === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
