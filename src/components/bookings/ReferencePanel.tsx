import { useState } from 'react'
import type { ReferenceJob } from './jobsReferenceApi'
import ReferenceJobCard from './ReferenceJobCard'
import ReferenceJobDrawer from './ReferenceJobDrawer'

type Props = {
  jobs: ReferenceJob[]
  loading: boolean
  error: string
  ready: boolean
  onCopyCargo: (job: ReferenceJob) => void
  className?: string
}

export function ReferencePanelContent({
  jobs,
  loading,
  error,
  ready,
  onCopyCargo,
}: Omit<Props, 'className'>) {
  const [selected, setSelected] = useState<ReferenceJob | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  function openJob(job: ReferenceJob) {
    setSelected(job)
    setDrawerOpen(true)
  }

  if (!ready) {
    return <p className="bf-ref-empty muted">Select shipper &amp; route to see past jobs for reference.</p>
  }

  if (loading) {
    return (
      <div className="bf-ref-skel">
        {[0, 1, 2].map((i) => <div key={i} className="bf-ref-skel__card" />)}
      </div>
    )
  }

  if (error) {
    return <p className="bf-ref-empty bf-field__error">{error}</p>
  }

  if (!jobs.length) {
    return <p className="bf-ref-empty muted">No past jobs found for this shipper and lane.</p>
  }

  return (
    <>
      <div className="bf-ref-list">
        {jobs.map((job, i) => (
          <ReferenceJobCard
            key={job.job_unique ?? job.house_bill ?? i}
            job={job}
            onClick={() => openJob(job)}
          />
        ))}
      </div>
      <ReferenceJobDrawer
        job={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCopyCargo={onCopyCargo}
      />
    </>
  )
}

export default function ReferencePanel({
  jobs,
  loading,
  error,
  ready,
  onCopyCargo,
  className,
}: Props) {
  return (
    <aside className={`bf-ref-panel${className ? ` ${className}` : ''}`} aria-label="Reference jobs">
      <div className="bf-ref-panel__head">
        <h2 className="bf-ref-panel__title">📋 Recent Jobs for this Shipper</h2>
        {ready && !loading && jobs.length > 0 && (
          <span className="bf-ref-panel__count">{jobs.length}</span>
        )}
      </div>
      <ReferencePanelContent
        jobs={jobs}
        loading={loading}
        error={error}
        ready={ready}
        onCopyCargo={onCopyCargo}
      />
    </aside>
  )
}
