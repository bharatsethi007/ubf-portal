// PortalUserRow.tsx — one customer portal login on the staff Info tab: role, who added them, last login, actions.
import PortalStatusPill from '../portalAccess/PortalStatusPill';
import { fmt } from './profileUi';
import type { PortalUser } from './customerInfoApi';

type Props = {
  p: PortalUser;
  addedBy: string;
  busy: boolean;
  onRole: (role: 'admin' | 'member') => void;
  onRevoke: () => void;
  onReactivate: () => void;
  onCopyLink: () => void;
};

export default function PortalUserRow({ p, addedBy, busy, onRole, onRevoke, onReactivate, onCopyLink }: Props) {
  const seen = p.last_login_at ? `Last login ${fmt.date(p.last_login_at)}` : p.status === 'active' ? 'Never logged in' : null;
  const since = p.status === 'active' && p.activated_at ? `Active since ${fmt.date(p.activated_at)}` : `Since ${fmt.date(p.created_at)}`;
  return (
    <div className="cp-portal-row">
      <div>
        <div className="cp-contact-name" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {p.display_name ? `${p.display_name} · ` : ''}{p.email || p.user_id}
          <PortalStatusPill status={p.status} />
          {p.role === 'admin' && p.status !== 'revoked' && <span className="cp-badge cp-badge--emerald">Admin</span>}
        </div>
        <div className="cp-contact-sub">{[since, seen, `Added by ${addedBy}`].filter(Boolean).join(' · ')}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {p.status !== 'revoked' && (
          <select className="cp-input" style={{ height: 30, width: 'auto', padding: '0 8px' }} aria-label="Portal role"
            value={p.role ?? 'member'} disabled={busy} onChange={(e) => onRole(e.target.value as 'admin' | 'member')}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        )}
        {p.status === 'pending' && (
          <button className="cp-btn cp-btn--sm" disabled={busy} onClick={onCopyLink}
            title="Makes a new link. Any invite link already emailed stops working.">Copy link</button>
        )}
        {p.status === 'revoked'
          ? <button className="cp-btn cp-btn--sm" disabled={busy} onClick={onReactivate}>Reactivate</button>
          : <button className="cp-btn cp-btn--sm cp-btn--danger" disabled={busy} onClick={onRevoke}>Revoke</button>}
      </div>
    </div>
  );
}
