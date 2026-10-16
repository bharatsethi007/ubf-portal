import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { addYears, missingFields, OFFICES, type Agreement, type AgreementPatch, type ContactSet, type OfficeCode } from './agreementsApi'

const TERMS = [1, 2, 3, 5]
const sec = 'm-0 text-[11px] uppercase tracking-[0.06em] text-[#5B6474]'
const grid2 = 'grid gap-3 md:grid-cols-2'

function Field({ label, missing, children, wide }: { label: string; missing?: boolean; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${wide ? 'md:col-span-2' : ''}`}>
      <span className="flex items-center justify-between gap-2 text-[11.5px] text-[#5B6474]">
        {label}
        {missing && <span className="rounded bg-[#FFFAEB] px-1.5 text-[10.5px] text-[#B54708]">Agent to complete</span>}
      </span>
      {children}
    </label>
  )
}

type Props = { a: Agreement; editable: boolean; saving: boolean; onSave: (p: AgreementPatch) => void }

/** Agreement terms: type, validity, offices, agent details, Schedule 1 contacts and commercials. */
export default function AgreementForm({ a, editable, saving, onSave }: Props) {
  const [f, setF] = useState<Agreement>(a)
  useEffect(() => setF(a), [a])
  const dirty = useMemo(() => JSON.stringify(f) !== JSON.stringify(a), [f, a])
  const set = (p: Partial<Agreement>) => setF((x) => ({ ...x, ...p }))
  const setContact = (side: 'agent_contacts' | 'ubf_contacts', k: keyof ContactSet, v: string) =>
    setF((x) => ({ ...x, [side]: { ...(x[side] ?? {}), [k]: v } }))
  const missing = new Set(missingFields(f))
  const years = TERMS.find((y) => addYears(f.effective_date, y) === f.expiry_date) ?? null
  const ro = !editable
  const inp = (key: keyof Agreement, placeholder?: string) => (
    <input className="input" disabled={ro} placeholder={placeholder} value={String(f[key] ?? '')}
      onChange={(e) => set({ [key]: e.target.value || null } as Partial<Agreement>)} />
  )
  const toggleOffice = (c: OfficeCode) => set({ offices: f.offices.includes(c) ? f.offices.filter((o) => o !== c) : [...f.offices, c] })

  function save() {
    const { id: _i, ref: _r, agent_id: _g, created_at: _c, updated_at: _u, ...patch } = f
    onSave(patch)
  }

  return (
    <section className="cp-card">
      <div className="cp-card-head">
        <h3 className="cp-card-title">Agreement terms</h3>
        <span className="font-mono text-[11.5px] text-[#5B6474]">{a.ref}</span>
      </div>
      <div className="flex flex-col gap-5 px-4 pb-4 pt-1">
        <div className={grid2}>
          {(['non_exclusive', 'exclusive'] as const).map((k) => (
            <label key={k} className={`flex items-start gap-2.5 rounded-[9px] border px-3 py-2.5 text-[12.5px] ${f.kind === k ? 'border-[#0A2472] bg-[#F8FAFF]' : 'border-[#E6E8EE]'}`}>
              <input type="radio" disabled={ro} checked={f.kind === k} onChange={() => set({ kind: k })} className="mt-0.5" />
              <span className="flex flex-col"><span>{k === 'exclusive' ? 'Exclusive' : 'Non-exclusive, reciprocal'}</span>
                <span className="text-[11.5px] text-[#5B6474]">{k === 'exclusive' ? 'Exclusivity schedule agreed separately' : 'Standard UBF agency co-operation agreement'}</span></span>
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-2.5">
          <p className={sec}>Validity</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="inline-flex rounded-lg bg-[#F1F3F7] p-[3px]" role="group" aria-label="Term">
              {TERMS.map((y) => (
                <button key={y} type="button" disabled={ro} onClick={() => set({ expiry_date: addYears(f.effective_date, y) })}
                  className={`h-[30px] rounded-md px-3 text-[12px] ${years === y ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#5B6474]'}`}>
                  {y} year{y > 1 ? 's' : ''}
                </button>
              ))}
            </div>
            <Field label="Effective date">
              <input type="date" className="input" disabled={ro} value={f.effective_date}
                onChange={(e) => e.target.value && set({ effective_date: e.target.value, expiry_date: addYears(e.target.value, years ?? 3) })} />
            </Field>
            <Field label="Expiry date">
              <input type="date" className="input" disabled={ro} value={f.expiry_date} onChange={(e) => e.target.value && set({ expiry_date: e.target.value })} />
            </Field>
            <Field label="Remind before expiry">
              <select className="input" disabled={ro} value={f.remind_days} onChange={(e) => set({ remind_days: Number(e.target.value) })}>
                {[30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <p className={sec}>UB Freight offices covered</p>
          <div className="grid gap-2.5 md:grid-cols-3">
            {OFFICES.map((o) => (
              <label key={o.code} className={`flex items-start gap-2.5 rounded-[9px] border px-3 py-2.5 text-[12.5px] ${f.offices.includes(o.code) ? 'border-[#0A2472] bg-[#F8FAFF]' : 'border-[#E6E8EE]'}`}>
                <input type="checkbox" disabled={ro} checked={f.offices.includes(o.code)} onChange={() => toggleOffice(o.code)} className="mt-0.5" />
                <span className="flex flex-col"><span>{o.country}</span><span className="text-[11.5px] text-[#5B6474]">{o.detail}</span></span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <p className={sec}>Agent details</p>
          <div className={grid2}>
            <Field label="Legal entity" missing={missing.has('Legal entity')}>{inp('agent_legal_name')}</Field>
            <Field label="Company number" missing={missing.has('Company number')}>{inp('agent_company_no', 'Agent fills on signing')}</Field>
            <Field label="Registered address" missing={missing.has('Registered address')} wide>{inp('agent_address')}</Field>
            <Field label="Signatory" missing={missing.has('Signatory')}>{inp('signatory_name')}</Field>
            <Field label="Designation" missing={missing.has('Designation')}>{inp('signatory_title', 'e.g. Managing Director')}</Field>
            <Field label="Signatory email" missing={missing.has('Signatory email')}>{inp('signatory_email')}</Field>
            <Field label="Territory / scope" missing={missing.has('Territory')}>{inp('agent_territory')}</Field>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <p className={sec}>Schedule 1 contacts</p>
          <div className="overflow-hidden rounded-[9px] border border-[#E6E8EE]">
            <div className="grid grid-cols-[130px_minmax(0,1fr)_minmax(0,1fr)] bg-[#F7F8FA] text-[11px] uppercase tracking-[0.04em] text-[#5B6474]">
              <span className="px-3 py-2">Role</span><span className="px-3 py-2">UB Freight Ltd</span><span className="px-3 py-2">Agent</span>
            </div>
            {(['operational', 'commercial', 'accounts', 'notices'] as const).map((k) => (
              <div key={k} className="grid grid-cols-[130px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 border-t border-[#F0F1F4] px-0 py-1.5">
                <span className="px-3 text-[12.5px] text-[#5B6474]">{k === 'notices' ? 'Formal notices' : `${k[0].toUpperCase()}${k.slice(1)}`}</span>
                <input className="input" disabled={ro} value={f.ubf_contacts?.[k] ?? ''} onChange={(e) => setContact('ubf_contacts', k, e.target.value)} />
                <input className="input mr-2" disabled={ro} placeholder="Agent to complete" value={f.agent_contacts?.[k] ?? ''} onChange={(e) => setContact('agent_contacts', k, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <p className={sec}>Commercial</p>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Billing currency">{inp('currency')}</Field>
            <Field label="Credit limit">{inp('credit_limit')}</Field>
            <Field label="Profit share" wide>{inp('profit_share')}</Field>
            <Field label="UBF payment terms" wide>{inp('payment_terms')}</Field>
            <Field label="Agent payment terms" wide>{inp('agent_payment_terms', 'Same as UBF unless stated')}</Field>
            <Field label="UBF insurance minimum" wide>{inp('insurance')}</Field>
            <Field label="Agent insurance minimum" wide>{inp('agent_insurance', 'e.g. Public liability')}</Field>
          </div>
          <Field label="Special terms (added to Schedule 1)">
            <textarea className="input" rows={2} disabled={ro} value={f.special_terms ?? ''} onChange={(e) => set({ special_terms: e.target.value || null })} />
          </Field>
        </div>

        <div className="flex flex-col gap-2.5">
          <p className={sec}>Signs for UB Freight</p>
          <div className={grid2}>
            <Field label="Name">{inp('ubf_signer_name')}</Field>
            <Field label="Designation">{inp('ubf_signer_title', 'e.g. General Manager')}</Field>
          </div>
        </div>

        {editable && (
          <div className="flex items-center justify-end gap-3 border-t border-[#F0F1F4] pt-3">
            {dirty && <span className="text-[12px] text-[#B54708]">Unsaved changes</span>}
            <button type="button" className="btn btn--inline" disabled={!dirty || saving} onClick={() => setF(a)}>Discard</button>
            <button type="button" className="btn quotes-page__new-btn" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save draft'}</button>
          </div>
        )}
      </div>
    </section>
  )
}
