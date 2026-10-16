import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FileDown, FileText, Pencil } from 'lucide-react'
import { fmtLong } from './AgreementPdfParts'
import { logEvent, updateAgreement, type Agreement } from './agreementsApi'

type Props = { a: Agreement; canEdit: boolean; onOpenPdf: () => void; onChanged: () => void; onVoid: () => void }

export const isUploaded = (a: Agreement | null) => a?.agent_signature?.method === 'uploaded'

/** Agreement filed from an old signed PDF: file, dates (editable), signers, notes. */
export default function UploadedAgreementView({ a, canEdit, onOpenPdf, onChanged, onVoid }: Props) {
  const sig = (a.agent_signature ?? {}) as { file_name?: string; uploaded_by?: string; uploaded_at?: string }
  const [editing, setEditing] = useState(false)
  const [eff, setEff] = useState(a.effective_date)
  const [exp, setExp] = useState(a.expiry_date)
  const [busy, setBusy] = useState(false)

  useEffect(() => { setEff(a.effective_date); setExp(a.expiry_date); setEditing(false) }, [a])

  async function save() {
    if (!eff || !exp || exp <= eff) { toast.error('Expiry must be after the start date'); return }
    setBusy(true)
    try {
      await updateAgreement(a.id, { effective_date: eff, expiry_date: exp })
      await logEvent(a.id, 'dates_changed', { from: [a.effective_date, a.expiry_date], to: [eff, exp] })
      toast.success('Dates updated')
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const row = 'grid grid-cols-[150px_minmax(0,1fr)] gap-3 border-t border-[#F0F1F4] py-2.5 text-[13px]'
  const k = 'text-[#5B6474]'
  return (
    <section className="cp-card">
      <div className="cp-card-head">
        <h3 className="cp-card-title">Uploaded agreement</h3>
        <span className="text-muted-foreground font-mono">{a.ref}</span>
      </div>
      <div className="flex flex-col px-4 pb-4">
        <button type="button" onClick={onOpenPdf}
          className="mb-3 flex items-center gap-3 rounded-[10px] border border-[#E6E8EE] bg-[#F8FAFF] px-3.5 py-3 text-left hover:border-[#C7D0E6]">
          <FileText size={22} className="flex-none text-[#0A2472]" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] text-[#0F172A]">{sig.file_name ?? 'Signed agreement.pdf'}</span>
            <span className="text-[11.5px] text-[#5B6474]">Uploaded{sig.uploaded_by ? ` by ${sig.uploaded_by}` : ''}{sig.uploaded_at ? ` · ${fmtLong(sig.uploaded_at)}` : ''}</span>
          </span>
          <FileDown size={16} className="flex-none text-[#5B6474]" />
        </button>

        <div className={row}>
          <span className={k}>Validity</span>
          {editing ? (
            <span className="flex flex-wrap items-center gap-2">
              <input type="date" className="input input--sm" value={eff} onChange={(e) => setEff(e.target.value)} />
              <span className={k}>to</span>
              <input type="date" className="input input--sm" value={exp} min={eff} onChange={(e) => setExp(e.target.value)} />
              <button type="button" className="btn btn--inline" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>
              <button type="button" className="btn btn--inline" disabled={busy} onClick={() => { setEditing(false); setEff(a.effective_date); setExp(a.expiry_date) }}>Cancel</button>
            </span>
          ) : (
            <span className="flex items-center gap-2">{fmtLong(a.effective_date)} to {fmtLong(a.expiry_date)}
              {canEdit && a.status === 'signed' && <button type="button" className="btn btn--inline !px-2 !py-1" onClick={() => setEditing(true)} title="Edit dates"><Pencil size={12} /> Edit</button>}
            </span>
          )}
        </div>
        <div className={row}><span className={k}>Offices</span><span>{a.offices.join(' · ')}</span></div>
        <div className={row}><span className={k}>Agent signatory</span><span>{a.signatory_name ?? '—'}</span></div>
        <div className={row}><span className={k}>Signed for UB Freight</span><span>{a.ubf_signer_name ?? '—'}</span></div>
        <div className={row}><span className={k}>Date signed</span><span>{a.signed_at ? fmtLong(a.signed_at) : '—'}</span></div>
        {a.special_terms && <div className={row}><span className={k}>Notes</span><span className="whitespace-pre-wrap">{a.special_terms}</span></div>}
        {canEdit && a.status === 'signed' && (
          <div className="flex justify-end border-t border-[#F0F1F4] pt-3">
            <button type="button" className="btn btn--inline" onClick={onVoid}>Void this upload</button>
          </div>
        )}
      </div>
    </section>
  )
}
