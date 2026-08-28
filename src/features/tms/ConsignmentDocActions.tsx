import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { ConsignmentFormValues } from './consignmentFormApi'

type Patch = (patch: Partial<ConsignmentFormValues>) => void

/** Pickup: emails Labels + Consignment Note PDFs to the sender. */
export function PickupDocActions({ v, patch }: { v: ConsignmentFormValues; patch: Patch }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-2.5">
      <p className="mb-1.5 text-[11px] font-medium text-neutral-500">Email to sender on create</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.email_labels} onChange={(e) => patch({ email_labels: e.target.checked })} />
          Labels
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.email_consignment_note} onChange={(e) => patch({ email_consignment_note: e.target.checked })} />
          Consignment Note
        </label>
      </div>
    </div>
  )
}

/** Drop-off: emails POD to the receiver contact, plus optional extra recipients. */
export function DropoffDocActions({ v, patch }: { v: ConsignmentFormValues; patch: Patch }) {
  const [draft, setDraft] = useState('')
  const emails = v.pod_additional_emails
  const addEmail = () => {
    const e = draft.trim()
    if (!e || emails.includes(e)) { setDraft(''); return }
    patch({ pod_additional_emails: [...emails, e] })
    setDraft('')
  }
  const removeEmail = (e: string) => patch({ pod_additional_emails: emails.filter((x) => x !== e) })
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-2.5">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={v.email_pod} onChange={(e) => patch({ email_pod: e.target.checked })} />
        Email POD to contact
      </label>
      {v.email_pod && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5">
            <input className="input input--sm flex-1" type="email" placeholder="Add another email…" value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail() } }} />
            <button type="button" onClick={addEmail} title="Add email"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 text-neutral-500 hover:bg-white"><Plus size={15} /></button>
          </div>
          {emails.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {emails.map((e) => (
                <span key={e} className="inline-flex items-center gap-1 rounded-full bg-[#0A2472]/10 px-2 py-0.5 text-xs text-[#0A2472]">
                  {e}
                  <button type="button" onClick={() => removeEmail(e)} className="text-[#0A2472]/70 hover:text-[#0A2472]"><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
