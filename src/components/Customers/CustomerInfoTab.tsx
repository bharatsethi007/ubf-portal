// CustomerInfoTab.tsx — company details, editable address/account, contacts, portal access.
import React, { useEffect, useState } from 'react';
import type { CustomerStats } from './customerProfileApi';
import { CustomerInfoAddressCard } from './CustomerInfoAddressCard';
import {
  fetchContacts, fetchPortalUsers, fetchMeta, fetchCustomerSync, saveMeta,
  grantPortalAccess, revokePortalAccess,
  regeneratePortalLink,
  resolveCustomerAddress,
  type Contact, type PortalUser, type PortalActivateResult, type CustomerMeta, type CustomerSync,
} from './customerInfoApi';
import PortalLinkCopy from '../portalAccess/PortalLinkCopy';
import PortalStatusPill from '../portalAccess/PortalStatusPill';
import { Card, fmt } from './profileUi';

export function CustomerInfoTab({
  accountId, stats, onReload,
}: { accountId: string; stats: CustomerStats | null; onReload: () => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [portal, setPortal] = useState<PortalUser[]>([]);
  const [meta, setMeta] = useState<CustomerMeta | null>(null);
  const [sync, setSync] = useState<CustomerSync | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadPortal = () => fetchPortalUsers(accountId).then(setPortal).catch(() => {});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchContacts(accountId),
      fetchPortalUsers(accountId),
      fetchMeta(accountId),
      fetchCustomerSync(accountId),
    ])
      .then(([c, p, m, s]) => {
        if (alive) {
          setContacts(c);
          setPortal(p);
          setMeta(m);
          setSync(s);
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [accountId]);

  if (loading || !meta) {
    return <div className="cp-skel-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="cp-skel cp-skel-card" />)}</div>;
  }

  const resolved = resolveCustomerAddress(meta, sync);
  const portalEmails = new Set(portal.map((p) => (p.email ?? '').toLowerCase()));

  return (
    <div className="cp-grid">
      <Card title="Company details">
        <dl className="cp-dl">
          <Row label="Name" value={stats?.name} />
          <Row label="Account #" value={accountId} />
          <Row label="Branch" value={stats?.branch} />
          <Row label="Sales manager" value={stats?.sales_manager} />
          <Row label="Type" value={[stats?.is_importer && 'Importer', stats?.is_exporter && 'Exporter'].filter(Boolean).join(' · ') || '—'} />
          <Row label="Contacts" value={String(stats?.contact_count ?? 0)} />
          <Row label="Status" value={stats?.closed ? 'Closed' : 'Active'} />
        </dl>
        <p className="cp-note">Synced from TradeWindow — read-only.</p>
      </Card>

      <CustomerInfoAddressCard meta={meta} setMeta={setMeta} resolved={resolved} />

      <ContactsCard
        contacts={contacts}
        portalEmails={portalEmails}
        onEnable={async (email) => { await grantPortalAccess(accountId, email); await reloadPortal(); onReload(); }}
      />

      <PortalCard
        accountId={accountId}
        portal={portal}
        active={!!stats?.has_portal_access}
        onChange={async () => { await reloadPortal(); onReload(); }}
      />

      <NotesCard meta={meta} setMeta={setMeta} />
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="cp-dl-row">
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}

function ContactsCard({
  contacts, portalEmails, onEnable,
}: { contacts: Contact[]; portalEmails: Set<string>; onEnable: (email: string) => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <Card title="Contacts" wide>
      {contacts.length === 0 ? <div className="cp-empty">No contacts</div> : (
        <div className="cp-contact-list">
          {contacts.map((c) => {
            const email = (c.email ?? '').toLowerCase();
            const hasPortal = email && portalEmails.has(email);
            const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || '—';
            return (
              <div key={c.id} className="cp-contact">
                <div className="cp-contact-main">
                  <div className="cp-contact-name">
                    {name}{c.is_prime && <span className="cp-badge cp-badge--indigo cp-ml">Prime</span>}
                  </div>
                  <div className="cp-contact-sub">{c.email || 'no email'}{c.phone ? ` · ${c.phone}` : ''}</div>
                </div>
                {email && (hasPortal
                  ? <span className="cp-badge cp-badge--emerald">Portal</span>
                  : <button className="cp-btn cp-btn--sm" disabled={busy === email}
                      onClick={async () => { setBusy(email); try { await onEnable(c.email!); } finally { setBusy(null); } }}>
                      {busy === email ? 'Sending…' : 'Enable portal'}
                    </button>)}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function PortalCard({
  accountId, portal, active, onChange,
}: { accountId: string; portal: PortalUser[]; active: boolean; onChange: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [issuedLink, setIssuedLink] = useState<PortalActivateResult | null>(null);

  const activate = async () => {
    if (!email.trim()) return;
    setBusy(true); setErr(null); setIssuedLink(null);
    try {
      const result = await grantPortalAccess(accountId, email);
      setIssuedLink(result);
      setEmail('');
      await onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };
  const revoke = async (uid: string) => {
    setBusy(true); setErr(null);
    try { await revokePortalAccess(uid); await onChange(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };
  const regen = async (uid: string) => {
    setBusy(true); setErr(null);
    try {
      const result = await regeneratePortalLink(uid);
      setIssuedLink(result);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card title="Portal access" action={
      <span className={`cp-badge ${active ? 'cp-badge--emerald' : 'cp-badge--slate'}`}>{active ? 'Active' : 'No access'}</span>
    }>
      {portal.length === 0 ? (
        <p className="cp-note" style={{ marginBottom: 12 }}>No portal access yet. Activate to give this customer online tracking.</p>
      ) : (
        <div className="cp-portal-list">
          {portal.map((p) => (
            <div key={p.user_id} className="cp-portal-row">
              <div>
                <div className="cp-contact-name" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {p.email || p.user_id}
                  <PortalStatusPill status={p.status} />
                </div>
                <div className="cp-contact-sub">
                  {p.status === 'active' && p.activated_at ? `Active since ${fmt.date(p.activated_at)}` : `Since ${fmt.date(p.created_at)}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {p.status === 'pending' && (
                  <button className="cp-btn cp-btn--sm" disabled={busy} onClick={() => regen(p.user_id)}>Copy link</button>
                )}
                {p.status !== 'revoked' && (
                  <button className="cp-btn cp-btn--sm cp-btn--danger" disabled={busy} onClick={() => revoke(p.user_id)}>Revoke</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="cp-grant">
        <input className="cp-input" type="email" placeholder="email to activate…" value={email}
          onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && activate()} />
        <button className="cp-btn cp-btn--primary" disabled={busy || !email.trim()} onClick={activate}>
          {busy ? 'Working…' : 'Activate'}
        </button>
      </div>
      {issuedLink && <PortalLinkCopy link={issuedLink.link} expiresAt={issuedLink.expires_at} onDismiss={() => setIssuedLink(null)} />}
      {err && <p className="cp-err">{err}</p>}
      <p className="cp-note">Creates a set-password link on the portal site — copy and send it to the customer.</p>
    </Card>
  );
}

function NotesCard({ meta, setMeta }: { meta: CustomerMeta; setMeta: (m: CustomerMeta) => void }) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const save = async () => {
    setSaving(true); setDone(false);
    try { await saveMeta(meta); setDone(true); setTimeout(() => setDone(false), 2000); }
    finally { setSaving(false); }
  };
  return (
    <Card title="Internal notes" wide action={
      <button className="cp-btn cp-btn--sm cp-btn--primary" disabled={saving} onClick={save}>
        {saving ? 'Saving…' : done ? 'Saved ✓' : 'Save'}
      </button>
    }>
      <textarea className="cp-textarea" rows={4} placeholder="Staff notes about this customer…"
        value={meta.notes ?? ''} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
    </Card>
  );
}
