import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { supabase } from '../supabase'

// "Sync now" queues a request for the current company; sync_agent.py on the server picks it up.
// The agent writes a heartbeat every 20s, so the button can tell "working" from "nobody listening".

type SyncJob = {
  id: number
  status: 'pending' | 'running' | 'done' | 'error' | string
  requested_by: string
  requested_at: string
  started_at: string | null
  finished_at: string | null
  message: string | null
}

type SyncAgent = {
  host: string | null
  last_seen: string
  state: string
  next_auto: string | null
  online: boolean
}

type SyncStatus = {
  company: string
  job: SyncJob | null
  last_done: string | null
  agent: SyncAgent | null
}

type Props = { userEmail: string }

const POLL_BUSY_MS = 5000
const POLL_IDLE_MS = 60000

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const sameDay = d.toDateString() === new Date().toDateString()
  return d.toLocaleString('en-NZ', sameDay
    ? { hour: '2-digit', minute: '2-digit', hour12: false }
    : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}

function minsSince(iso: string | null): number {
  if (!iso) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

function view(s: SyncStatus | null): { text: string; title?: string; spinning: boolean; busy: boolean; warn?: boolean } {
  if (!s) return { text: '', spinning: false, busy: false }
  const job = s.job
  const online = !!s.agent?.online
  const open = job && (job.status === 'pending' || job.status === 'running')
  const last = s.last_done ? `Last synced ${fmtTime(s.last_done)}` : 'Never synced'

  if (open && !online) {
    return {
      text: 'Sync agent offline',
      title: s.agent
        ? `The sync agent on ${s.agent.host ?? 'the server'} was last seen ${fmtTime(s.agent.last_seen)}. Your request is queued and runs when it is back.`
        : 'No sync agent is running on the server. Your request is queued and runs when it starts.',
      spinning: false, busy: false, warn: true,
    }
  }
  if (job?.status === 'pending') return { text: 'Queued…', spinning: true, busy: true }
  if (job?.status === 'running') {
    const m = minsSince(job.started_at)
    return { text: `Syncing… ${m ? `${m} min` : ''}`.trim(), spinning: true, busy: true,
      title: 'Main sync, charges, then reports. Usually a few minutes.' }
  }
  if (!online) {
    return { text: `${last} · agent offline`, warn: true, spinning: false, busy: false,
      title: 'No sync agent is running on the server, so Sync now cannot run.' }
  }
  if (job?.status === 'error' && job.finished_at && (!s.last_done || job.finished_at > s.last_done)) {
    return { text: 'Last sync failed', title: job.message ?? undefined, warn: true, spinning: false, busy: false }
  }
  return { text: last, spinning: false, busy: false,
    title: online
      ? `Sync agent online${s.agent?.next_auto ? ` · next auto-sync ${fmtTime(s.agent.next_auto)}` : ''}`
      : `Sync agent offline since ${fmtTime(s.agent?.last_seen ?? null)}` }
}

export default function SyncButton({ userEmail }: Props) {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [rpcError, setRpcError] = useState<string | null>(null)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('sync_status')
    if (!mounted.current) return
    if (error) { setRpcError(error.message); return }
    setRpcError(null)
    setStatus(data as SyncStatus)
  }, [])

  const v = view(status)

  useEffect(() => {
    mounted.current = true
    void load()
    return () => { mounted.current = false }
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => void load(), v.busy || v.warn ? POLL_BUSY_MS : POLL_IDLE_MS)
    return () => window.clearInterval(id)
  }, [v.busy, v.warn, load])

  async function handleSync() {
    if (!userEmail || v.busy || submitting) return
    setSubmitting(true)
    const { data, error } = await supabase.rpc('request_sync')
    setSubmitting(false)
    if (error) { setRpcError(error.message); return }
    setRpcError(null)
    setStatus(data as SyncStatus)
  }

  const spinning = submitting || v.spinning
  return (
    <div className="sync-btn-wrap">
      <button type="button" className="sync-btn" disabled={v.busy || submitting || !userEmail}
        title={v.title} onClick={() => void handleSync()}>
        {spinning ? <Loader2 size={15} className="sync-btn__spin" /> : <RefreshCw size={15} strokeWidth={2} />}
        Sync now
      </button>
      {rpcError ? (
        <span className="sync-btn__status" style={{ color: 'var(--danger, #b42318)' }} title={rpcError}>Sync unavailable</span>
      ) : v.text ? (
        <span className={v.warn ? 'sync-btn__status' : 'sync-btn__last muted'} title={v.title}
          style={v.warn ? { color: 'var(--danger, #b42318)' } : undefined}>
          {v.text}
        </span>
      ) : null}
    </div>
  )
}
