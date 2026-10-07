// CustomerContactsCard.tsx — CF contacts (read-only) plus contacts added in the console (editable, not synced to CF).
import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { addContact, deleteContact, updateContact, type Contact, type ContactDraft } from './customerInfoApi';
import { Card } from './profileUi';

type Props = {
  accountId: string;
  contacts: Contact[];
  portalEmails: Set<string>;
  onEnable: (email: string) => Promise<void>;
  onChanged: () => Promise<void>;
};

const empty: ContactDraft = { first_name: '', last_name: '', email: '', phone: '' };
const iconBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, padding: 0 } as const;

export function CustomerContactsCard({ accountId, contacts, portalEmails, onEnable, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<ContactDraft>(empty);

  const start = (c?: Contact) => {
    setEditing(c ? c.id : 'new');
    setDraft(c ? { first_name: c.first_name ?? '', last_name: c.last_name ?? '', email: c.email ?? '', phone: c.phone ?? '' } : empty);
  };

  const save = async () => {
    if (!draft.first_name.trim() && !draft.last_name.trim()) { toast.error('Add a name'); return; }
    if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) { toast.error('Email looks wrong'); return; }
    setBusy('save');
    try {
      if (editing === 'new') await addContact(accountId, draft);
      else if (typeof editing === 'number') await updateContact(editing, draft);
      setEditing(null);
      await onChanged();
      toast.success('Contact saved');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed'); }
    finally { setBusy(null); }
  };

  const remove = async (c: Contact) => {
    if (!window.confirm(`Delete ${[c.first_name, c.last_name].filter(Boolean).join(' ') || 'this contact'}?`)) return;
    setBusy(`del:${c.id}`);
    try { await deleteContact(c.id); await onChanged(); toast.success('Contact deleted'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setBusy(null); }
  };

  const form = (
    <div className="cp-contact" style={{ alignItems: 'flex-start' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, flex: 1 }}>
        <input className="cp-input cp-input--block" placeholder="First name" autoFocus value={draft.first_name} onChange={(e) => setDraft({ ...draft, first_name: e.target.value })} />
        <input className="cp-input cp-input--block" placeholder="Last name" value={draft.last_name} onChange={(e) => setDraft({ ...draft, last_name: e.target.value })} />
        <input className="cp-input cp-input--block" placeholder="Email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        <input className="cp-input cp-input--block" placeholder="Phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') void save(); }} />
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="cp-btn cp-btn--primary" style={iconBtn} title="Save" aria-label="Save" disabled={busy === 'save'} onClick={save}><Check size={15} /></button>
        <button className="cp-btn" style={iconBtn} title="Cancel" aria-label="Cancel" onClick={() => setEditing(null)}><X size={15} /></button>
      </div>
    </div>
  );

  return (
    <Card title="Contacts" wide action={
      <button className="cp-btn cp-btn--sm" style={iconBtn} title="Add contact" aria-label="Add contact" onClick={() => start()}>
        <Plus size={15} />
      </button>
    }>
      {editing === 'new' && form}
      {contacts.length === 0 && editing !== 'new' ? <div className="cp-empty">No contacts</div> : (
        <div className="cp-contact-list">
          {contacts.map((c) => {
            if (editing === c.id) return <div key={c.id}>{form}</div>;
            const email = (c.email ?? '').toLowerCase();
            const hasPortal = email && portalEmails.has(email);
            const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || '—';
            const local = c.source === 'console';
            return (
              <div key={c.id} className="cp-contact">
                <div className="cp-contact-main">
                  <div className="cp-contact-name">
                    {name}
                    {c.is_prime && <span className="cp-badge cp-badge--indigo cp-ml">Prime</span>}
                    {local && <span className="cp-badge cp-ml" style={{ background: '#FFF7ED', color: '#C2410C' }} title="Added in the console. CyberFreight does not have this contact.">Not synced with CF</span>}
                  </div>
                  <div className="cp-contact-sub">{c.email || 'no email'}{c.phone ? ` · ${c.phone}` : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {email && (hasPortal
                    ? <span className="cp-badge cp-badge--emerald">Portal</span>
                    : <button className="cp-btn cp-btn--sm" disabled={busy === email}
                        onClick={async () => { setBusy(email); try { await onEnable(c.email!); } finally { setBusy(null); } }}>
                        {busy === email ? 'Sending…' : 'Enable portal'}
                      </button>)}
                  {local && (
                    <>
                      <button className="cp-btn" style={iconBtn} title="Edit contact" aria-label="Edit contact" onClick={() => start(c)}><Pencil size={14} /></button>
                      <button className="cp-btn cp-btn--danger" style={iconBtn} title="Delete contact" aria-label="Delete contact"
                        disabled={busy === `del:${c.id}`} onClick={() => void remove(c)}><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="cp-note">CF contacts sync from CyberFreight and are read-only. Contacts you add here stay in the portal only.</p>
    </Card>
  );
}
