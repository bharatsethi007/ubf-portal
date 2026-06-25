import React, { useState } from 'react';
import {
  resolvedToMetaFields,
  saveMeta,
  type CustomerMeta,
  type ResolvedCustomerAddress,
} from './customerInfoApi';
import { Card } from './profileUi';

type AddressDraft = Pick<
  CustomerMeta,
  'address_line1' | 'address_line2' | 'city' | 'region' | 'postcode' | 'country'
>;

export function CustomerInfoAddressCard({
  meta,
  setMeta,
  resolved,
}: {
  meta: CustomerMeta;
  setMeta: (m: CustomerMeta) => void;
  resolved: ResolvedCustomerAddress;
}) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<AddressDraft | null>(null);

  const f = (k: keyof Pick<CustomerMeta, 'account_owner' | 'credit_terms'>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setMeta({ ...meta, [k]: e.target.value });

  const saveAccount = async () => {
    setSaving(true); setDone(false);
    try { await saveMeta(meta); setDone(true); setTimeout(() => setDone(false), 2000); }
    finally { setSaving(false); }
  };

  function openEdit() {
    setDraft(resolvedToMetaFields(resolved));
    setDialogOpen(true);
  }

  async function saveOverride() {
    if (!draft) return;
    setSaving(true);
    try {
      const next = { ...meta, ...draft };
      await saveMeta(next);
      setMeta(next);
      setDialogOpen(false);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card
        title="Address & contact"
        action={
          <button type="button" className="cp-btn cp-btn--sm" onClick={openEdit}>
            Edit override
          </button>
        }
      >
        <dl className="cp-dl">
          <AddrRow label="Address line 1" value={resolved.line1} />
          <AddrRow label="Address line 2" value={resolved.line2} />
          <AddrRow label="City" value={resolved.city} />
          <AddrRow label="Region" value={resolved.region} />
          <AddrRow label="Postcode" value={resolved.postcode} />
          <AddrRow label="Country" value={resolved.country} />
          <AddrRow label="Phone" value={resolved.phone} />
          <AddrRow label="Email" value={resolved.email} />
          <AddrRow label="Contact" value={resolved.contact} />
        </dl>
        <div className="cp-form" style={{ marginTop: 16 }}>
          <Field label="Account owner" value={meta.account_owner} onChange={f('account_owner')} />
          <Field label="Credit terms" value={meta.credit_terms} onChange={f('credit_terms')} />
        </div>
        <p className="cp-note">Staff overrides take precedence over TradeWindow sync. Phone, email, and contact are synced only.</p>
        <SaveBtn saving={saving} done={done} onClick={saveAccount} />
      </Card>

      {dialogOpen && draft && (
        <AddressEditDialog
          draft={draft}
          saving={saving}
          onChange={setDraft}
          onClose={() => setDialogOpen(false)}
          onSave={saveOverride}
        />
      )}
    </>
  );
}

function AddrRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="cp-dl-row">
      <dt>{label}</dt>
      <dd className={value ? undefined : 'muted'}>{value || '—'}</dd>
    </div>
  );
}

function AddressEditDialog({
  draft,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  draft: AddressDraft;
  saving: boolean;
  onChange: (d: AddressDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const f = (k: keyof AddressDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...draft, [k]: e.target.value });

  return (
    <div className="cp-modal-overlay" onClick={onClose}>
      <div className="cp-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="cp-modal-head">
          <h3 className="cp-card-title">Edit address override</h3>
          <button type="button" className="cp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="cp-modal-body cp-form">
          <Field label="Address line 1" value={draft.address_line1} onChange={f('address_line1')} full />
          <Field label="Address line 2" value={draft.address_line2} onChange={f('address_line2')} full />
          <Field label="City" value={draft.city} onChange={f('city')} />
          <Field label="Region" value={draft.region} onChange={f('region')} />
          <Field label="Postcode" value={draft.postcode} onChange={f('postcode')} />
          <Field label="Country" value={draft.country} onChange={f('country')} />
        </div>
        <div className="cp-modal-foot">
          <button type="button" className="cp-btn" disabled={saving} onClick={onClose}>Cancel</button>
          <button type="button" className="cp-btn cp-btn--primary" disabled={saving} onClick={onSave}>
            {saving ? 'Saving…' : 'Save override'}
          </button>
        </div>
        <p className="cp-note cp-modal-note">Saved to staff overrides only — TradeWindow sync is not modified.</p>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, full,
}: { label: string; value: string | null; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; full?: boolean }) {
  return (
    <div className={full ? 'cp-field cp-field--full' : 'cp-field'}>
      <label className="cp-field-label">{label}</label>
      <input className="cp-input cp-input--block" value={value ?? ''} onChange={onChange} />
    </div>
  );
}

function SaveBtn({ saving, done, onClick }: { saving: boolean; done: boolean; onClick: () => void }) {
  return (
    <button className="cp-btn cp-btn--sm cp-btn--primary" disabled={saving} onClick={onClick} style={{ marginTop: 12 }}>
      {saving ? 'Saving…' : done ? 'Saved ✓' : 'Save'}
    </button>
  );
}
