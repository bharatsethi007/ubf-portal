import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { supabase } from '../supabase'

type SyncJob = {
  id?: string
  requested_by: string
  requested_at: string
  finished_at: string | null
  status: string
  message?: string | null
}

type Props = { userEmail: string }

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function statusLabel(job: SyncJob | null): { text: string; title?: string; spinning?: boolean } {
  if (!job) return { text: '' }
  switch (job.status) {
    case 'pending':
      return { text: 'Queued', spinning: true }
    case 'running':
      return { text: 'Syncing…', spinning: true }
    case 'done':
      return { text: `Synced ✓ · Last synced ${fmtTime(job.finished_at)}` }
    case 'error':
      return { text: 'Sync failed', title: job.message ?? undefined }
    default:
      return { text: job.status }
  }
}

export default function SyncButton({ userEmail }: Props) {
  const [activeJob, setActiveJob] = useState<SyncJob | null>(null)
  const [lastDone, setLastDone] = useState<SyncJob | null>(null)
  const [polling, setPolling] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const mountedRef = useRef(true)

  const fetchLatest = useCallback(async (): Promise<SyncJob | null> => {
    const { data } = await supabase
      .from('sync_jobs')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return (data as SyncJob) ?? null
  }, [])

  const fetchLastDone = useCallback(async () => {
    const { data } = await supabase
      .from('sync_jobs')
      .select('*')
      .eq('status', 'done')
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (mountedRef.current && data) setLastDone(data as SyncJob)
  }, [])

  const pollLatest = useCallback(async () => {
    const job = await fetchLatest()
    if (!mountedRef.current || !job) return
    setActiveJob(job)
    if (job.status === 'done' || job.status === 'error') {
      setPolling(false)
      if (job.status === 'done') setLastDone(job)
    }
  }, [fetchLatest])

  useEffect(() => {
    mountedRef.current = true
    fetchLastDone()
    fetchLatest().then((job) => {
      if (!mountedRef.current || !job) return
      if (job.status === 'pending' || job.status === 'running') {
        setActiveJob(job)
        setPolling(true)
      }
    })
    return () => {
      mountedRef.current = false
    }
  }, [fetchLatest, fetchLastDone])

  useEffect(() => {
    if (!polling) return
    pollLatest()
    const id = window.setInterval(pollLatest, 5000)
    return () => window.clearInterval(id)
  }, [polling, pollLatest])

  const busy = submitting || polling || activeJob?.status === 'pending' || activeJob?.status === 'running'
  const display = activeJob && (polling || activeJob.status === 'done' || activeJob.status === 'error')
    ? statusLabel(activeJob)
    : null

  async function handleSync() {
    if (!userEmail || busy) return
    setSubmitting(true)
    setActiveJob(null)
    const { error } = await supabase.from('sync_jobs').insert({ requested_by: userEmail })
    setSubmitting(false)
    if (error) {
      setActiveJob({
        requested_by: userEmail,
        requested_at: new Date().toISOString(),
        finished_at: null,
        status: 'error',
        message: error.message,
      })
      return
    }
    setPolling(true)
    await pollLatest()
  }

  return (
    <div className="sync-btn-wrap">
      <button
        type="button"
        className="sync-btn"
        disabled={busy || !userEmail}
        onClick={handleSync}
      >
        {display?.spinning ? (
          <Loader2 size={15} className="sync-btn__spin" />
        ) : (
          <RefreshCw size={15} strokeWidth={2} />
        )}
        Sync now
      </button>
      {display?.text && (
        <span className="sync-btn__status" title={display.title}>
          {display.text}
        </span>
      )}
      {!display && lastDone?.finished_at && (
        <span className="sync-btn__last muted">
          Last synced {fmtTime(lastDone.finished_at)}
        </span>
      )}
    </div>
  )
}
