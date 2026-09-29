import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, RotateCcw, Send, ShieldCheck, UserMinus, UserPlus } from 'lucide-react'
import InviteForm from './InviteForm'
import { fetchTeam, initials, lastSeen, remove, resend, restore, setRole, type Member, type Team } from './teamApi'
import './team.css'

/** Customer team: who has portal access. Admins invite, change roles and remove; members can see the list. */
export default function TeamPage() {
  const [team, setTeam] = useState<Team | null>(null)
  const [err, setErr] = useState('')
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [inviting, setInviting] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setTeam(await fetchTeam()); setErr('') } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load') }
  }, [])
  useEffect(() => { void load() }, [load])

  const admin = team?.my_role === 'admin'
  const active = (team?.members ?? []).filter((m) => m.status !== 'revoked')
  const removed = (team?.members ?? []).filter((m) => m.status === 'revoked')

  async function run(m: Member, fn: () => Promise<unknown>, ok: string) {
    setBusy(m.user_id); setNote(null); setConfirm(null)
    try { await fn(); setNote({ ok: true, text: ok }); await load() }
    catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : 'Failed' }) }
    finally { setBusy(null) }
  }

  function Row({ m }: { m: Member }) {
    const who = m.name || m.email
    return (
      <li className={`pv3-team__person${m.status === 'revoked' ? ' pv3-team__person--off' : ''}`}>
        <span className={`pv3-team__av${m.role === 'admin' ? ' pv3-team__av--admin' : ''}`}>{initials(m)}</span>
        <div className="pv3-team__who">
          <b>{who}{m.is_me && <em> (you)</em>}</b>
          <span>{m.name ? m.email : ''}{m.name ? ' · ' : ''}{lastSeen(m)}{m.invited_by ? ` · added by ${m.invited_by}` : ''}</span>
        </div>
        {m.status === 'pending' && <span className="pv3-team__pill pv3-team__pill--amber">Invited</span>}
        {m.role === 'admin' && m.status !== 'revoked' && <span className="pv3-team__pill"><ShieldCheck size={12} /> Admin</span>}
        {admin && (
          <div className="pv3-team__acts">
            {busy === m.user_id ? <Loader2 size={16} className="pv3-spin" /> : m.status === 'revoked' ? (
              <button type="button" className="pv3-textbtn" onClick={() => void run(m, () => restore(m.user_id), `New invite sent to ${m.email}.`)}><RotateCcw size={14} /> Re-invite</button>
            ) : confirm === m.user_id ? (
              <>
                <span className="pv3-team__ask">Remove {m.is_me ? 'yourself' : 'access'}?</span>
                <button type="button" className="pv3-btn pv3-btn--ghost pv3-team__danger" onClick={() => void run(m, () => remove(m.user_id), `${who} no longer has access.`)}>Remove</button>
                <button type="button" className="pv3-textbtn" onClick={() => setConfirm(null)}>Cancel</button>
              </>
            ) : (
              <>
                {m.status === 'pending' && <button type="button" className="pv3-textbtn" onClick={() => void run(m, () => resend(m.user_id), `Invite resent to ${m.email}.`)}><Send size={14} /> Resend</button>}
                <select aria-label={`Role for ${who}`} value={m.role} onChange={(e) => void run(m, () => setRole(m.user_id, e.target.value as 'admin' | 'member'), `${who} is now ${e.target.value}.`)}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="button" className="pv3-iconbtn" aria-label={`Remove ${who}`} title="Remove access" onClick={() => setConfirm(m.user_id)}><UserMinus size={16} /></button>
              </>
            )}
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="pv3-page pv3-team">
      <Link to="/portal" className="pv3-textbtn pv3-team__back"><ArrowLeft size={14} /> Back</Link>
      <div className="pv3-head pv3-rise">
        <div>
          <h1>Team</h1>
          <p>{admin ? 'Give colleagues their own login. Everyone sees your company’s shipments, bookings and invoices.' : 'People at your company with portal access. Ask an admin to add or remove someone.'}</p>
        </div>
        {admin && !inviting && (
          <div className="pv3-head__actions">
            <button type="button" className="pv3-btn pv3-btn--primary" onClick={() => { setInviting(true); setNote(null) }}><UserPlus size={15} /> Invite</button>
          </div>
        )}
      </div>

      {err && <div className="pv3-error">{err}</div>}
      {note && <div className={note.ok ? 'pv3-team__ok' : 'pv3-team__err'} role="status">{note.text}</div>}
      {inviting && <InviteForm onClose={() => setInviting(false)} onDone={(msg) => { setInviting(false); setNote({ ok: true, text: msg }); void load() }} />}

      <section className="pv3-card pv3-team__card pv3-rise">
        <header><b>{active.length} {active.length === 1 ? 'person' : 'people'}</b></header>
        {!team && !err && <div className="pv3-skel-list" style={{ padding: 16 }}>{[0, 1, 2].map((i) => <span key={i} className="pv3-skel" />)}</div>}
        <ul>{active.map((m) => <Row key={m.user_id} m={m} />)}</ul>
      </section>

      {removed.length > 0 && (
        <section className="pv3-card pv3-team__card pv3-rise">
          <header><b>Removed</b><span className="pv3-muted">No access. {admin ? 'Re-invite to restore.' : ''}</span></header>
          <ul>{removed.map((m) => <Row key={m.user_id} m={m} />)}</ul>
        </section>
      )}
      <p className="pv3-foot">Admins can invite people, change roles and remove access. Your account always keeps at least one admin.</p>
    </div>
  )
}
