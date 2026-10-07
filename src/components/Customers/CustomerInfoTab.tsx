// CustomerInfoTab.tsx — company details, editable address/account, contacts, portal access.
import React, { useEffect, useState } from 'react';
import type { CustomerStats } from './customerProfileApi';
import { CustomerInfoAddressCard } from './CustomerInfoAddressCard';
import { CustomerContactsCard } from './CustomerContactsCard';
import {
  fetchContacts, fetchPortalUsers, fetchMeta, fetchCustomerSync, saveMeta,
  grantPortalAccess, revokePortalAccess,
  regeneratePortalLink, reactivatePortalAccess, setPortalRole,
  resolveCustomerAddress,
  type Contact, type PortalUser, type PortalActivateResult, type CustomerMeta, type CustomerSync,
} from './customerInfoApi';
import PortalLinkCopy from '../portalAccess/PortalLinkCopy';
import PortalUserRow from './PortalUserRow';
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

      <CustomerContactsCard
        accountId={accountId}
        contacts={contacts}
        portalEmails={portalEmails}
        onEnable={async (email) => { await grantPortalAccess(accountId, email); await reloadPortal(); onReload(); }}
        onChanged={async () => { setContacts(await fetchContacts(accountId)); onReload(); }}
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
  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await fn(); await onChange(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };
  // Customer-invited users name the colleague who added them; anyone else was set up by UBF staff.
  const addedBy = (p: PortalUser) => {
    const by = portal.find((x) => x.user_id === p.invited_by);
    return by ? (by.display_name || by.email || 'a colleague') : 'UB Freight';
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
            <PortalUserRow key={p.user_id} p={p} busy={busy} addedBy={addedBy(p)}
              onRole={(r) => act(() => setPortalRole(p.user_id, r))}
              onRevoke={() => revoke(p.user_id)}
              onReactivate={() => act(() => reactivatePortalAccess(p.user_id))}
              onCopyLink={() => regen(p.user_id)} />
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
