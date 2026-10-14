// SliPrefsCard.tsx — the customer's SLI choices (template, PDF copy) saved from the public SLI page.
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { Card } from './profileUi';

type Profile = {
  key: string; save_template: boolean; email_pdf: boolean; pdf_email: string | null;
  template: { prefilled?: Record<string, string>; answers?: Record<string, unknown>; signed_name?: string | null } | null;
  template_saved_at: string | null; updated_at: string;
};

const ANSWER_LABEL: Record<string, string> = {
  is_paying: 'Pays freight', insurance_required: 'Insurance', country_of_origin: 'Origin', purpose_of_export: 'Purpose',
  caa_screening_auth: 'Screening consent', collection_mode: 'Cartage', pickup_address: 'Pickup from', declared_currency: 'Currency',
};
const show = (v: unknown) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : v === 'pickup' ? 'UBF pickup' : v === 'dropoff' ? 'Drop-off' : String(v ?? ''));
const when = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function SliPrefsCard({ accountId }: { accountId: string }) {
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = () => supabase.from('sli_profiles').select('*').eq('account_id', accountId).order('updated_at', { ascending: false }).limit(1)
    .then(({ data }) => setP(((data ?? [])[0] as Profile | undefined) ?? null), () => setP(null));
  useEffect(() => { void load(); }, [accountId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(v: Partial<Profile>) {
    if (!p) return;
    setBusy(true);
    const { error } = await supabase.from('sli_profiles').update({ ...v, updated_at: new Date().toISOString() }).eq('key', p.key);
    setBusy(false);
    if (error) alert(error.message); else void load();
  }

  if (p === undefined) return null;
  const tpl = p?.template;
  const shipper = tpl?.prefilled ?? {};
  const answers = Object.entries(tpl?.answers ?? {}).filter(([k]) => ANSWER_LABEL[k]);

  return (
    <Card title="SLI preferences" action={p?.template_saved_at ? <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Template saved {when(p.template_saved_at)}</span> : null}>
      {!p ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>Nothing saved yet. The customer chooses after signing their first SLI.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={p.save_template} disabled={busy} onChange={(e) => void patch({ save_template: e.target.checked })} />
            Prefill new SLIs from the saved template
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={p.email_pdf} disabled={busy} onChange={(e) => void patch({ email_pdf: e.target.checked })} />
            Email a PDF copy after signing{p.pdf_email ? <span style={{ color: 'var(--color-muted)' }}> to {p.pdf_email}</span> : null}
          </label>
          {tpl ? (
            <div style={{ borderTop: '1px solid var(--color-line)', paddingTop: 10, display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 4, columnGap: 10 }}>
              <span style={{ color: 'var(--color-muted)' }}>Shipper</span>
              <span>{[shipper.supplier_name, shipper.supplier_address, shipper.supplier_city].filter(Boolean).join(', ') || '—'}</span>
              {shipper.supplier_contact || shipper.supplier_email ? <><span style={{ color: 'var(--color-muted)' }}>Contact</span><span>{[shipper.supplier_contact, shipper.supplier_phone, shipper.supplier_email].filter(Boolean).join(' · ')}</span></> : null}
              {tpl.signed_name ? <><span style={{ color: 'var(--color-muted)' }}>Signs as</span><span>{tpl.signed_name}</span></> : null}
              {answers.map(([k, v]) => <React.Fragment key={k}><span style={{ color: 'var(--color-muted)' }}>{ANSWER_LABEL[k]}</span><span>{show(v)}</span></React.Fragment>)}
            </div>
          ) : null}
          {tpl ? (
            <button type="button" disabled={busy} onClick={() => { if (confirm('Clear the saved SLI template for this customer?')) void patch({ template: null, template_saved_at: null, save_template: false }); }}
              style={{ alignSelf: 'flex-start', background: 'none', border: 0, padding: 0, color: '#B42318', fontSize: 12, cursor: 'pointer' }}>
              Clear template
            </button>
          ) : null}
        </div>
      )}
    </Card>
  );
}
