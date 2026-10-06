// Pick a job: suggestions from refs / containers / MBL found in the thread, or type to search.
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { searchJobs, type JobHit } from './inboxApi'
import { TEAM_LABEL } from './inboxFormat'

const d = (x: string | null) => (x ? new Date(x).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }) : null)

export default function JobPicker({ convId, value, onPick }: { convId: string; value: JobHit | null; onPick: (j: JobHit) => void }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<JobHit[] | null>(null)

  useEffect(() => {
    let live = true
    const t = setTimeout(() => {
      searchJobs(convId, q.trim()).then((r) => { if (live) setHits(r ?? []) }).catch(() => { if (live) setHits([]) })
    }, q ? 250 : 0)
    return () => { live = false; clearTimeout(t) }
  }, [convId, q])

  return (
    <div>
      <label className="ibx-search" style={{ background: '#fff', border: '1px solid #E1DFDD' }}>
        <Search size={16} />
        <input autoFocus aria-label="Search jobs" placeholder="Job ref, container, MBL, customer…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div style={{ fontSize: 12, color: '#605E5C', margin: '10px 2px 6px' }}>{q ? 'Results' : 'Suggested from this conversation'}</div>
      <div className="ibx-jobs">
        {hits === null ? <div className="ibx-jobs__empty">Searching…</div> : null}
        {hits?.length === 0 ? <div className="ibx-jobs__empty">{q ? 'No jobs found.' : 'No match in this email. Search above.'}</div> : null}
        {hits?.map((j) => (
          <button key={j.id} type="button" className={`ibx-job${value?.id === j.id ? ' ibx-job--on' : ''}`} onClick={() => onPick(j)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="ibx-mono" style={{ fontWeight: 500 }}>{j.booking_ref}</span>
              {j.job_no ? <span className="ibx-mono" style={{ color: '#605E5C' }}>{j.job_no}</span> : null}
              <span className="ibx-chip" style={{ background: '#F3F2F1', color: '#424242' }}>{TEAM_LABEL[j.module] ?? j.module}</span>
              {j.linked ? <span className="ibx-chip ibx-chip--done">Linked</span> : null}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#605E5C', textTransform: 'capitalize' }}>{j.status}</span>
            </div>
            <div className="ibx-ellip" style={{ fontSize: 12.5, color: '#424242', marginTop: 3 }}>
              {[j.customer, j.customer_ref && `Ref ${j.customer_ref}`, j.mbl_no && `MBL ${j.mbl_no}`, j.hawb && `HBL ${j.hawb}`,
                j.containers, d(j.eta) && `ETA ${d(j.eta)}`].filter(Boolean).join(' · ') || 'No details yet'}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
