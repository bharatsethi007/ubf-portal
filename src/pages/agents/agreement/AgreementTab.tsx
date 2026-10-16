import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FileDown, Eye, Plus, Send, Upload } from 'lucide-react'
import { usePerm } from '../../../access/PermissionsProvider'
import type { AgentRow } from '../agentsApi'
import { supabase } from '../../../supabase'
import AgreementForm from './AgreementForm'
import SendAgreementDialog from './SendAgreementDialog'
import UploadAgreementDialog from './UploadAgreementDialog'
import UploadedAgreementView, { isUploaded } from './UploadedAgreementView'
import { downloadAgreementPdf, previewAgreementPdf } from './AgreementPdf'
import { fmtLong } from './AgreementPdfParts'
import {
  createDraft, filledCount, listAgreements, listEvents, logEvent, missingFields, updateAgreement,
  type Agreement, type AgreementEvent, type AgreementPatch,
} from './agreementsApi'

const STEPS: { key: string; label: string }[] = [
  { key: 'draft', label: 'Draft' }, { key: 'sent', label: 'Sent' }, { key: 'viewed', label: 'Viewed' },
  { key: 'signed', label: 'Signed by agent' }, { key: 'filed', label: 'Filed' },
]
const ORDER: Record<string, number> = { draft: 0, sent: 1, viewed: 2, signed: 3 }
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', sent: 'Sent', viewed: 'Viewed', signed: 'Signed', void: 'Void' }
const EVENT_LABEL: Record<string, string> = {
  created: 'Draft created', updated: 'Draft updated', sent: 'Sent for signature', link_created: 'Signing link created', viewed: 'Opened by agent',
  details_confirmed: 'Agent confirmed details', signed: 'Signed by agent', filed: 'Signed PDF filed', voided: 'Voided', reminded: 'Reminder sent', emailed: 'Signed copy emailed to both parties', email_failed: 'Signed copy email failed',
  uploaded: 'Signed PDF uploaded', dates_changed: 'Dates changed',
}

function pickCurrent(list: Agreement[]): Agreement | null {
  return list.find((a) => a.status !== 'void' && a.status !== 'signed') ?? list.find((a) => a.status === 'signed') ?? null
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Agency agreement tab: create, edit draft, preview and download PDF, history and activity. */
export default function AgreementTab({ agent, onChanged }: { agent: AgentRow; onChanged: () => void }) {
  const canEdit = usePerm('agreements', 'edit')
  const [list, setList] = useState<Agreement[]>([])
  const [sel, setSel] = useState<Agreement | null>(null)
  const [events, setEvents] = useState<AgreementEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)

  const load = useCallback(async (keepId?: string) => {
    setLoading(true)
    try {
      const rows = await listAgreements(agent.id)
      setList(rows)
      setSel(rows.find((r) => r.id === keepId) ?? pickCurrent(rows) ?? rows[0] ?? null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load agreements')
    } finally {
      setLoading(false)
    }
  }, [agent.id])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!sel) { setEvents([]); return }
    listEvents(sel.id).then(setEvents).catch(() => setEvents([]))
  }, [sel])

  async function create() {
    setBusy(true)
    try {
      const a = await createDraft(agent)
      toast.success(`Draft ${a.ref} created, ${filledCount(a)} fields filled`)
      await load(a.id)
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create draft')
    } finally {
      setBusy(false)
    }
  }

  async function save(p: AgreementPatch) {
    if (!sel) return
    setBusy(true)
    try {
      const a = await updateAgreement(sel.id, p)
      await logEvent(a.id, 'updated')
      toast.success('Draft saved')
      await load(a.id)
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function voidDraft() {
    if (!sel || !window.confirm(`Void ${sel.ref}? It stays in history.`)) return
    setBusy(true)
    try {
      await updateAgreement(sel.id, { status: 'void' })
      await logEvent(sel.id, 'voided')
      await load()
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function openSigned() {
    if (!sel?.signed_pdf_key) return
    const { data } = await supabase.functions.invoke('agreement-sign', { body: { op: 'link', id: sel.id } })
    const url = (data as { url?: string } | null)?.url
    if (url) window.open(url, '_blank', 'noopener')
    else toast.error('Signed PDF not available')
  }

  async function pdfAction(kind: 'view' | 'download') {
    if (!sel) return
    setBusy(true)
    try { await (kind === 'view' ? previewAgreementPdf(sel) : downloadAgreementPdf(sel)) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'PDF failed') }
    finally { setBusy(false) }
  }

  if (loading && !list.length) return <section className="cp-card"><p className="text-muted-foreground pad-inline">Loading…</p></section>

  if (!sel) {
    return (
      <section className="cp-card">
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="text-[15px]">No agency agreement yet</span>
          <span className="max-w-[460px] text-[12.5px] text-[#5B6474]">Create a draft. It fills from this agent's ERP account and contacts, covers NZ, FJ and AU, and runs 3 years.</span>
          {canEdit ? (
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="btn quotes-page__new-btn" disabled={busy} onClick={create}><Plus size={15} /> Create agreement</button>
              <button type="button" className="btn btn--inline" disabled={busy} onClick={() => setUploadOpen(true)}><Upload size={14} /> Upload signed PDF</button>
            </div>
          ) : <span className="text-[12px] text-[#5B6474]">Admins and Pricing Leads can create agreements.</span>}
        </div>
        <UploadAgreementDialog agent={agent} open={uploadOpen} onOpenChange={setUploadOpen} onDone={(id) => { void load(id); onChanged() }} />
      </section>
    )
  }

  const step = sel.status === 'signed' && sel.signed_pdf_key ? 4 : ORDER[sel.status] ?? 0
  const missing = missingFields(sel)
  const editable = canEdit && sel.status === 'draft'
  const canRenew = canEdit && !list.some((a) => a.status === 'draft' || a.status === 'sent' || a.status === 'viewed')
  const uploaded = isUploaded(sel)

  return (
    <div className="flex flex-col gap-4">
      {sel.status !== 'void' && !uploaded && (
        <section className="cp-card px-5 py-4">
          <ol className="m-0 grid list-none grid-cols-5 p-0">
            {STEPS.map((st, i) => (
              <li key={st.key} className="flex flex-col gap-2">
                <div className="flex items-center">
                  <span className={`inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11.5px] ${i <= step ? 'bg-[#0A2472] text-white' : 'bg-white text-[#5B6474] shadow-[inset_0_0_0_1.5px_#D0D5DD]'}`}>{i + 1}</span>
                  {i < 4 && <span className={`mx-2 h-0.5 flex-1 ${i < step ? 'bg-[#0A2472]' : 'bg-[#EEF0F3]'}`} />}
                </div>
                <span className={`text-[12.5px] ${i <= step ? 'text-[#0F172A]' : 'text-[#5B6474]'}`}>{st.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[999_1_640px]">
          {uploaded
            ? <UploadedAgreementView a={sel} canEdit={canEdit} onOpenPdf={() => void openSigned()} onChanged={() => { void load(sel.id); onChanged() }} onVoid={() => void voidDraft()} />
            : <AgreementForm a={sel} editable={editable} saving={busy} onSave={(p) => void save(p)} />}
        </div>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          {!uploaded && <section className="cp-card">
            <div className="cp-card-head"><h3 className="cp-card-title">Document</h3><span className="text-muted-foreground">9 to 11 pages</span></div>
            <div className="flex flex-col gap-2 px-4 pb-4">
              <span className="text-[12.5px] text-[#5B6474]">Cover, parties, clauses 1 to 19, Schedule 1 and execution, built from this record.</span>
              <div className="flex gap-2">
                <button type="button" className="btn btn--inline flex-1" disabled={busy} onClick={() => void pdfAction('view')}><Eye size={14} /> Preview</button>
                <button type="button" className="btn btn--inline flex-1" disabled={busy} onClick={() => void pdfAction('download')}><FileDown size={14} /> Download</button>
              </div>
            </div>
          </section>}

          {uploaded ? (canEdit && (
            <section className="cp-card">
              <div className="cp-card-head"><h3 className="cp-card-title">Actions</h3></div>
              <div className="flex flex-col gap-2 px-4 pb-4">
                {canRenew && <button type="button" className="btn quotes-page__new-btn justify-center" disabled={busy} onClick={() => void create()}><Plus size={14} /> New agreement in portal</button>}
                <button type="button" className="btn btn--inline justify-center" disabled={busy} onClick={() => setUploadOpen(true)}><Upload size={14} /> Upload another signed PDF</button>
              </div>
            </section>
          )) : <section className="cp-card">
            <div className="cp-card-head"><h3 className="cp-card-title">Signing</h3><span className="text-muted-foreground">{STATUS_LABEL[sel.status]}</span></div>
            <div className="flex flex-col gap-3 px-4 pb-4 text-[12.5px]">
              <div className="flex flex-col"><span>{sel.ubf_signer_name ?? 'UB Freight signer not set'}</span><span className="text-[11.5px] text-[#5B6474]">Signs for UB Freight · {sel.ubf_signed_at ? `signed ${fmtLong(sel.ubf_signed_at)}` : 'signs on send'}</span></div>
              <div className="flex flex-col"><span>{sel.signatory_name ?? 'Agent signatory not set'}</span><span className="text-[11.5px] text-[#5B6474]">{sel.signatory_email ?? 'No email'} · {sel.signed_at ? `signed ${fmtLong(sel.signed_at)}` : 'signs second'}</span></div>
              {sel.status === 'draft' && missing.length > 0 && (
                <div className="rounded-lg bg-[#FFFAEB] px-3 py-2 text-[12px] leading-[17px] text-[#B54708]">{missing.length} field{missing.length > 1 ? 's' : ''} missing: {missing.join(', ')}. The agent completes them before signing.</div>
              )}
              {canEdit && ['draft', 'sent', 'viewed'].includes(sel.status) && (
                <button type="button" className="btn quotes-page__new-btn justify-center" disabled={busy} onClick={() => setSendOpen(true)}>
                  <Send size={14} /> {sel.status === 'draft' ? 'Send or share' : 'Resend or share link'}
                </button>
              )}
              {sel.signed_pdf_key && (
                <button type="button" className="btn btn--inline justify-center" onClick={() => void openSigned()}><FileDown size={14} /> Signed agreement PDF</button>
              )}
              <div className="flex gap-2">
                {editable && <button type="button" className="btn btn--inline flex-1" disabled={busy} onClick={() => void voidDraft()}>Void draft</button>}
                {canRenew && <button type="button" className="btn btn--inline flex-1" disabled={busy} onClick={() => void create()}><Plus size={14} /> {list.some((a) => a.status === 'signed') ? 'Renew' : 'New agreement'}</button>}
              </div>
              {canEdit && <button type="button" className="btn btn--inline justify-center" disabled={busy} onClick={() => setUploadOpen(true)}><Upload size={14} /> Upload signed PDF</button>}
            </div>
          </section>}

          <section className="cp-card">
            <div className="cp-card-head"><h3 className="cp-card-title">Activity</h3></div>
            <ol className="m-0 flex list-none flex-col gap-2.5 px-4 pb-4">
              {events.length === 0 ? <li className="text-[12.5px] text-[#5B6474]">No activity yet.</li> : events.map((e) => (
                <li key={e.id} className="grid grid-cols-[10px_minmax(0,1fr)] gap-2.5 text-[12.5px]">
                  <span className="mt-[5px] h-2 w-2 rounded-full bg-[#C7D0E6]" />
                  <span className="flex flex-col"><span>{EVENT_LABEL[e.kind] ?? e.kind}</span><span className="text-[11.5px] text-[#5B6474]">{e.actor ?? 'System'} · {when(e.created_at)}</span></span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <UploadAgreementDialog agent={agent} open={uploadOpen} onOpenChange={setUploadOpen} onDone={(id) => { void load(id); onChanged() }} />
      <SendAgreementDialog a={sel} open={sendOpen} onOpenChange={setSendOpen} onSent={() => { void load(sel.id); onChanged() }} />

      <section className="cp-card">
        <div className="cp-card-head"><h3 className="cp-card-title">History</h3><span className="text-muted-foreground">All agreements with this agent</span></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Ref</th><th>Validity</th><th>Offices</th><th>Status</th><th>Signed</th></tr></thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className={`row-clickable${a.id === sel.id ? ' bg-[#F8FAFF]' : ''}`} onClick={() => setSel(a)}>
                  <td className="font-mono text-[12px]">{a.ref}</td>
                  <td>{fmtLong(a.effective_date)} to {fmtLong(a.expiry_date)}</td>
                  <td>{a.offices.join(' · ')}</td>
                  <td>{STATUS_LABEL[a.status]}{isUploaded(a) ? ' · uploaded' : ''}</td>
                  <td>{a.signed_at ? fmtLong(a.signed_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
