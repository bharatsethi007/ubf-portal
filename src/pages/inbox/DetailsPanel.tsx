import { Link } from 'react-router-dom'
import type { InboxDetail } from './inboxApi'
import { avatarColors, CHANNEL_META, initials, TEAM_LABEL } from './inboxFormat'
import TriagePanel from './TriagePanel'
import { whoOf } from './ThreadView'

const STAGE_TONE: Record<string, [string, string]> = {
  request: ['#FFF4E5', '#9A4A00'], booked: ['#F1F5F9', '#334155'], in_transit: ['#EFF6FF', '#1D4ED8'],
  arrived: ['#FFF4E5', '#9A4A00'], invoicing: ['#F4F3FF', '#5B21B6'], closed: ['#ECFDF3', '#067647'],
}

function fmtDate(d: string | null): string | null {
  return d ? new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }) : null
}

function mins(a: string, b: string): string {
  const m = Math.round((Date.parse(b) - Date.parse(a)) / 60000)
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`
}

export default function DetailsPanel({ detail, onChanged }: { detail: InboxDetail; onChanged: () => void }) {
  if (!detail.account && !detail.contact?.contact_type) return <TriagePanel detail={detail} onChanged={onChanged} />

  const c = detail.conversation
  const who = whoOf(detail)
  const due = c.reply_due_at ? Date.parse(c.reply_due_at) - Date.now() : null

  return (
    <aside className="ibx-side ibx-pane" aria-label="Contact details">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6 }}>
        <span className="ibx-av ibx-av--lg" style={avatarColors(who)}>{initials(who)}</span>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{who}</div>
        {detail.account ? (
          <Link to={`/customers/${detail.account.account_id}`} style={{ fontSize: 13, fontWeight: 500 }}>{detail.account.name}</Link>
        ) : (
          <span style={{ fontSize: 13, color: '#64748B', textTransform: 'capitalize' }}>{detail.contact?.contact_type}</span>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          {detail.contact ? (
            <span className="ibx-chip ibx-chip--done"><span className="ibx-dot" style={{ background: CHANNEL_META.whatsapp.color, width: 6, height: 6 }} />+{detail.contact.wa_id}</span>
          ) : null}
          {detail.account?.portal_users ? (
            <span className="ibx-chip" style={{ background: '#EEF3FF', color: '#0A2472' }}>{detail.account.portal_users} portal users</span>
          ) : null}
        </div>
      </div>

      {detail.account ? (
        <div>
          <h3>Shipments</h3>
          {detail.shipments.length === 0 ? <div style={{ fontSize: 13, color: '#64748B' }}>No open bookings.</div> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {detail.shipments.map((s) => {
              const [bg, fg] = STAGE_TONE[s.stage ?? ''] ?? ['#F1F5F9', '#334155']
              return (
                <Link key={s.id} to={`/bookings/${s.id}`} className={`ibx-card${s.focus ? ' ibx-card--focus' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span className="ibx-mono" style={{ fontWeight: 500 }}>{s.booking_ref ?? 'Booking'}</span>
                    {s.stage ? <span className="ibx-chip" style={{ background: bg, color: fg, textTransform: 'capitalize' }}>{s.stage.replace('_', ' ')}</span> : null}
                  </div>
                  <div className="ibx-ellip" style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
                    {[s.origin, s.destination].filter(Boolean).join(' → ')}
                    {s.last_free_day ? ` · LFD ${fmtDate(s.last_free_day)}` : s.eta ? ` · ETA ${fmtDate(s.eta)}` : ''}
                  </div>
                  {s.next_action ? <div className="ibx-ellip" style={{ fontSize: 12.5, color: '#334155', marginTop: 2 }}>Next: {s.next_action}</div> : null}
                </Link>
              )
            })}
          </div>
        </div>
      ) : null}

      <div>
        <h3>Conversation</h3>
        <div className="ibx-kv"><span>Team</span><span>{c.team ? TEAM_LABEL[c.team] ?? c.team : 'Not set'}</span></div>
        <div className="ibx-kv"><span>Assignee</span><span>{c.assignee_name ?? 'Unassigned'}</span></div>
        <div className="ibx-kv"><span>Status</span><span style={{ textTransform: 'capitalize' }}>{c.eff_status}</span></div>
        {c.first_reply_at ? <div className="ibx-kv"><span>First reply</span><span>{mins(c.created_at, c.first_reply_at)}</span></div> : null}
        {due !== null ? (
          <div className="ibx-kv"><span>Reply due</span>
            <span style={{ color: due < 0 ? '#B42318' : '#B54708', fontWeight: 500 }}>{due < 0 ? 'Overdue' : `in ${Math.max(1, Math.round(due / 60000))} min`}</span>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
