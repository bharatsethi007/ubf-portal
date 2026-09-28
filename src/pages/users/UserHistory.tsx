import { useEffect, useMemo, useState } from 'react'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { KeyRound, LogIn, LogOut, Mail, ShieldCheck, ShieldOff, ShieldPlus, UserCheck, UserX, type LucideIcon } from 'lucide-react'
import { supabase } from '../../supabase'
import { displayName, type StaffProfile } from './staffProfileApi'

type Event = { id: number; event: string; ip: string | null; user_agent: string | null; actor_id: string | null; created_at: string; mfa?: boolean }
type Filter = 'all' | 'signin' | 'password' | 'mfa' | 'account'

const META: Record<string, { label: string; icon: LucideIcon; group: Filter; tone?: string }> = {
  login: { label: 'Signed in', icon: LogIn, group: 'signin' },
  logout: { label: 'Signed out', icon: LogOut, group: 'signin' },
  mfa_verified: { label: 'Two-factor code accepted', icon: ShieldCheck, group: 'mfa' },
  mfa_enrolled: { label: 'Two-factor set up', icon: ShieldPlus, group: 'mfa' },
  mfa_removed: { label: 'Two-factor reset', icon: ShieldOff, group: 'mfa', tone: '#b45309' },
  password_changed: { label: 'Password changed', icon: KeyRound, group: 'password' },
  reset_link_sent: { label: 'Password reset link sent', icon: Mail, group: 'password' },
  account_disabled: { label: 'Account disabled', icon: UserX, group: 'account', tone: '#dc2626' },
  account_enabled: { label: 'Account re-enabled', icon: UserCheck, group: 'account' },
}
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'signin', label: 'Sign-ins' }, { key: 'password', label: 'Password' },
  { key: 'mfa', label: 'Two-factor' }, { key: 'account', label: 'Account' },
]

function device(ua: string | null): string | null {
  if (!ua) return null
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : null
  const os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : null
  return [browser, os].filter(Boolean).join(' on ') || null
}
function dayLabel(d: Date) { return isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEE d MMM yyyy') }

// Fold a two-factor pass that closely follows a sign-in into that sign-in row.
function fold(rows: Event[]): Event[] {
  const asc = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const out: Event[] = []
  for (const r of asc) {
    const prev = out[out.length - 1]
    if (r.event === 'mfa_verified' && prev?.event === 'login' && !prev.mfa
      && new Date(r.created_at).getTime() - new Date(prev.created_at).getTime() < 10 * 60_000) { prev.mfa = true; continue }
    out.push({ ...r })
  }
  return out.reverse()
}

export default function UserHistory({ userId, staff }: { userId: string; staff: StaffProfile[] }) {
  const [rows, setRows] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    let off = false
    setLoading(true)
    void supabase.from('staff_auth_events').select('id,event,ip,user_agent,actor_id,created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(200)
      .then(({ data, error: e }) => {
        if (off) return
        if (e) setError(e.message); else setRows(fold((data ?? []) as Event[]))
        setLoading(false)
      })
    return () => { off = true }
  }, [userId])

  const shown = useMemo(() => rows.filter((r) => filter === 'all' || META[r.event]?.group === filter), [rows, filter])
  const nameOf = (id: string) => { const s = staff.find((x) => x.user_id === id); return s ? displayName(s) : 'an admin' }

  let lastDay = ''
  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {FILTERS.map((f) => {
          const on = filter === f.key
          return (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              style={{ fontSize: 12.5, padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${on ? '#2563EB' : 'var(--line)'}`, background: on ? '#EFF4FF' : '#fff', color: on ? '#2563EB' : '#334155' }}>
              {f.label}
            </button>
          )
        })}
      </div>

      {loading ? <div className="muted" style={{ fontSize: 13 }}>Loading…</div>
        : error ? <div className="muted" style={{ fontSize: 13 }}>{error}</div>
        : shown.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>No activity recorded yet.</div>
        : shown.map((r) => {
          const d = new Date(r.created_at)
          const day = dayLabel(d)
          const header = day !== lastDay ? (lastDay = day) : null
          const m = META[r.event] ?? { label: r.event, icon: KeyRound, group: 'all' as Filter }
          const Icon = m.icon
          const sub = [device(r.user_agent), r.ip, r.actor_id ? `by ${nameOf(r.actor_id)}` : null].filter(Boolean).join(' · ')
          return (
            <div key={r.id}>
              {header && <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: '#94a3b8', margin: '18px 0 6px' }}>{header}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ display: 'inline-grid', placeItems: 'center', width: 30, height: 30, borderRadius: 8, background: '#f1f5f9', color: m.tone ?? '#475569', flexShrink: 0 }}>
                  <Icon size={15} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: m.tone ?? '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {m.label}
                    {r.mfa && <span style={{ fontSize: 10, fontWeight: 600, color: '#15803d', background: '#ecfdf5', padding: '1px 7px', borderRadius: 999 }}>2FA</span>}
                  </div>
                  {sub && <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
                </div>
                <span title={format(d, 'd MMM yyyy, h:mm:ss a')} style={{ fontSize: 12, color: '#64748b', flexShrink: 0 }}>
                  {format(d, 'h:mm a')}
                  <span style={{ color: '#94a3b8' }}> · {formatDistanceToNow(d, { addSuffix: true })}</span>
                </span>
              </div>
            </div>
          )
        })}
    </div>
  )
}
