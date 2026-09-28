// Public route /t/:token — customer live tracking. No auth; the token is the key.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Anchor, Gauge, Package, Ship } from 'lucide-react'
import TrackMap from './TrackMap'
import TrackEtaCard from './TrackEtaCard'
import TrackTimeline from './TrackTimeline'
import { fetchTrack, type PublicTrack, type TrackResult } from './trackApi'
import { ago, boxType, fmtStamp } from './trackFormat'

const POLL_MS = 60_000

function useIsDesktop() {
  const q = '(min-width: 768px)'
  const [d, setD] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setD(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return d
}

function Notice({ title, msg }: { title: string; msg: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1A3A] p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <img src="/ub-freight-logo.png" alt="UB Freight" className="mx-auto mb-4 h-9 w-auto" />
        <h1 className="text-lg font-medium text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{msg}</p>
      </div>
    </div>
  )
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="flex items-center gap-2 text-slate-500">{icon}{label}</span>
      <span className="truncate text-right text-slate-800">{value}</span>
    </div>
  )
}

function Panel({ t }: { t: PublicTrack }) {
  const v = t.vessel
  const vesselLine = v?.name ? [v.name, v.voyage].filter(Boolean).join(' · ') : null
  const now = v?.position
    ? [v.speed_kn != null ? `${v.speed_kn} kn` : null, v.nm_to_go != null ? `${v.nm_to_go.toLocaleString()} nm to go` : null].filter(Boolean).join(' · ') || 'At sea'
    : null
  return (
    <>
      <TrackEtaCard t={t} />
      <div className="border-b border-slate-100 px-5 py-3">
        <Fact icon={<Ship size={15} />} label="Vessel" value={vesselLine} />
        <Fact icon={<Gauge size={15} />} label="Now" value={now} />
        {v?.position_at ? <p className="-mt-0.5 text-right text-[11px] text-slate-400">Position {ago(v.position_at)}</p> : null}
        {t.containers.map((c) => (
          <Fact key={c.no} icon={<Package size={15} />} label="Container" value={[c.no, boxType(c.type)].filter(Boolean).join(' · ')} />
        ))}
        <Fact icon={<Anchor size={15} />} label="Booking" value={t.ref} />
      </div>
      <TrackTimeline t={t} />
      <div className="px-5 pb-5 text-[11px] leading-5 text-slate-400">
        {t.updated_at ? <p>Updated {ago(t.updated_at)} · times in your local timezone</p> : null}
        <p>Estimates can change. Questions? Contact your UB Freight team.</p>
        <p>Link valid until {fmtStamp(t.expires_at)}</p>
      </div>
    </>
  )
}

export default function PublicTrackPage() {
  const { token = '' } = useParams()
  const [res, setRes] = useState<TrackResult | null>(null)
  const desktop = useIsDesktop()

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'; meta.content = 'noindex,nofollow'
    document.head.appendChild(meta)
    return () => { meta.remove() }
  }, [])

  useEffect(() => {
    let alive = true
    void fetchTrack(token).then((r) => { if (alive) setRes(r) })
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void fetchTrack(token, true).then((r) => { if (alive && r.kind === 'ok') setRes(r) })
    }, POLL_MS)
    return () => { alive = false; window.clearInterval(id) }
  }, [token])

  const t = res?.kind === 'ok' ? res.data : null
  useEffect(() => { if (t?.ref) document.title = `Tracking ${t.ref} · UB Freight` }, [t?.ref])

  const padding = useMemo(() => (desktop
    ? { top: 60, bottom: 60, left: 430, right: 70 }
    : { top: 40, bottom: 40, left: 30, right: 60 }), [desktop])

  if (!res) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B1A3A]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#F7941D]" aria-label="Loading" />
      </div>
    )
  }
  if (res.kind === 'missing') return <Notice title="Tracking link not found" msg="Check the link, or ask UB Freight for a new one." />
  if (res.kind === 'expired') return <Notice title="This link has expired" msg="Ask your UB Freight contact for a fresh tracking link." />
  if (res.kind === 'revoked') return <Notice title="This link is no longer active" msg="Ask your UB Freight contact for a fresh tracking link." />
  if (!t) return <Notice title="Tracking is unavailable" msg="Please try again in a few minutes." />

  if (desktop) {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-[#0B1A3A]">
        <TrackMap track={t} padding={padding} />
        <aside className="absolute left-4 top-4 flex max-h-[calc(100vh-2rem)] w-[380px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="min-h-0 flex-1 overflow-y-auto"><Panel t={t} /></div>
        </aside>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-white">
      <div className="relative h-[42vh] min-h-[260px] w-full overflow-hidden bg-[#0B1A3A]">
        <TrackMap track={t} padding={padding} />
      </div>
      <div className="-mt-4 relative rounded-t-2xl bg-white overflow-hidden shadow-[0_-8px_24px_rgba(0,0,0,0.18)]">
        <Panel t={t} />
      </div>
    </div>
  )
}
