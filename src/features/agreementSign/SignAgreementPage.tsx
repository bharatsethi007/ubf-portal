import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { agreementPdfBlob, agreementFileName } from '../../pages/agents/agreement/AgreementPdf'
import { fmtLong } from '../../pages/agents/agreement/AgreementPdfParts'
import { OFFICES, type Agreement, type ContactSet } from '../../pages/agents/agreement/agreementModel'
import SignaturePad from './SignaturePad'

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agreement-sign`
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string
async function call(body: Record<string, unknown>): Promise<{ status: number; data: any }> {
  const res = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify(body) })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}
function blobToBase64(b: Blob): Promise<string> {
  return new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = bad; r.readAsDataURL(b) })
}

type State = 'loading' | 'form' | 'done' | 'invalid' | 'expired' | 'error'
const CONTACTS: { k: keyof ContactSet; label: string }[] = [
  { k: 'operational', label: 'Operational' }, { k: 'commercial', label: 'Commercial' }, { k: 'accounts', label: 'Accounts' }, { k: 'notices', label: 'Formal notices' },
]

/** Public page: agent reads the agreement, confirms details and signs. */
export default function SignAgreementPage() {
  const { token = '' } = useParams()
  const [state, setState] = useState<State>('loading')
  const [a, setA] = useState<Agreement | null>(null)
  const [f, setF] = useState<Partial<Agreement>>({})
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [mode, setMode] = useState<'typed' | 'drawn'>('typed')
  const [drawn, setDrawn] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    call({ op: 'get', token }).then(({ status, data }) => {
      if (status === 410) return setState('expired')
      if (!data?.agreement) return setState(status === 404 ? 'invalid' : 'error')
      const ag = data.agreement as Agreement
      setA(ag); setF(ag)
      setState(ag.status === 'signed' ? 'done' : 'form')
    }).catch(() => setState('error'))
  }, [token])

  useEffect(() => {
    if (!a) return
    let url: string | null = null
    agreementPdfBlob(a).then((b) => { url = URL.createObjectURL(b); setPdfUrl(url) }).catch(() => setPdfUrl(null))
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [a])

  const set = (p: Partial<Agreement>) => setF((x) => ({ ...x, ...p }))
  const contacts = (f.agent_contacts ?? {}) as ContactSet
  const offices = useMemo(() => OFFICES.filter((o) => a?.offices.includes(o.code)).map((o) => o.country).join(', '), [a])
  const ready = !!(f.agent_legal_name?.trim() && f.agent_company_no?.trim() && f.signatory_name?.trim() && f.signatory_title?.trim() && contacts.accounts?.trim() && consent && (mode === 'typed' || drawn))

  async function sign() {
    setBusy(true); setErr('')
    try {
      const { data } = await call({
        op: 'sign', token, consent,
        fields: { agent_legal_name: f.agent_legal_name, agent_company_no: f.agent_company_no, agent_address: f.agent_address, signatory_name: f.signatory_name, signatory_title: f.signatory_title, agent_contacts: contacts },
        signature: { method: mode, image: mode === 'drawn' ? drawn : undefined },
      })
      if (!data?.agreement) throw new Error(data?.error ?? 'Signing failed')
      const signed = data.agreement as Agreement
      const blob = await agreementPdfBlob(signed, mode === 'drawn' ? drawn : null)
      await call({ op: 'file', token, pdf_base64: await blobToBase64(blob) })
      setPdfUrl(URL.createObjectURL(blob))
      setA(signed)
      setState('done')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Signing failed')
    } finally {
      setBusy(false)
    }
  }

  const inp = 'h-9 w-full rounded-lg border border-[#E6E8EE] px-2.5 text-[13px] outline-none focus:border-[#0A2472]'
  const lbl = 'flex items-center justify-between text-[11.5px] text-[#5B6474]'
  const req = <span className="text-[#B54708]">Required</span>

  return (
    <div className="min-h-screen bg-[#F4F5F8] text-[13px] text-[#0F172A]">
      <header className="bg-[#0A2472] text-white">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-6">
          <span className="flex items-center gap-3"><img src="/ub-logo-pdf.png" alt="UB Freight" className="h-8" /><span className="text-[13px] text-[#C7D0E6]">Agency agreement</span></span>
          {a?.signatory_email && <span className="hidden text-[12px] text-[#C7D0E6] sm:block">Secure link for {a.signatory_email}</span>}
        </div>
      </header>

      {state === 'loading' && <p className="p-10 text-center text-[#5B6474]">Loading agreement…</p>}
      {(state === 'invalid' || state === 'expired' || state === 'error') && (
        <div className="mx-auto mt-16 max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="m-0 text-[16px]">{state === 'expired' ? 'This signing link has expired' : state === 'invalid' ? 'This link is not valid' : 'Something went wrong'}</p>
          <p className="mt-2 text-[#5B6474]">Contact UB Freight at bharats@ubfreight.com for a new link.</p>
        </div>
      )}

      {a && (state === 'form' || state === 'done') && (
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-start gap-6 p-6">
          <main className="flex min-w-0 flex-[999_1_620px] flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="m-0 text-[20px] font-medium">Agency Co-operation Agreement</h1>
                <p className="m-0 text-[12.5px] text-[#5B6474]">UB Freight Ltd and {a.agent_legal_name} · {fmtLong(a.effective_date)} to {fmtLong(a.expiry_date)} · {offices}</p>
              </div>
              {pdfUrl && <a href={pdfUrl} download={agreementFileName(a)} className="text-[#0A2472]">Download PDF</a>}
            </div>
            {pdfUrl
              ? <iframe title="Agreement" src={pdfUrl} className="h-[78vh] w-full rounded-md border border-[#E6E8EE] bg-white" />
              : <div className="flex h-[60vh] items-center justify-center rounded-md border border-[#E6E8EE] bg-white text-[#5B6474]">Preparing document…</div>}
          </main>

          <aside className="flex min-w-0 flex-[1_1_360px] flex-col gap-4 rounded-xl border border-[#E6E8EE] bg-white p-5">
            {state === 'done' ? (
              <div className="flex flex-col gap-3">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#ECFDF3] px-2.5 py-1 text-[12px] text-[#067647]">Signed {fmtLong(a.signed_at)}</span>
                <p className="m-0 text-[15px]">Thank you, the agreement is signed by both parties.</p>
                <p className="m-0 text-[#5B6474]">A copy is on its way to {a.signatory_email}. You can also download it now.</p>
                {pdfUrl && <a href={pdfUrl} download={agreementFileName(a)} className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0A2472] text-white">Download signed agreement</a>}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  <p className="m-0 text-[14px]">Confirm your details</p>
                  <label className="flex flex-col gap-1"><span className={lbl}>Legal entity {req}</span><input className={inp} value={f.agent_legal_name ?? ''} onChange={(e) => set({ agent_legal_name: e.target.value })} /></label>
                  <label className="flex flex-col gap-1"><span className={lbl}>Company / registration number {req}</span><input className={inp} value={f.agent_company_no ?? ''} onChange={(e) => set({ agent_company_no: e.target.value })} /></label>
                  <label className="flex flex-col gap-1"><span className={lbl}>Registered address</span><input className={inp} value={f.agent_address ?? ''} onChange={(e) => set({ agent_address: e.target.value })} /></label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="flex flex-col gap-1"><span className={lbl}>Your name {req}</span><input className={inp} value={f.signatory_name ?? ''} onChange={(e) => set({ signatory_name: e.target.value })} /></label>
                    <label className="flex flex-col gap-1"><span className={lbl}>Designation {req}</span><input className={inp} value={f.signatory_title ?? ''} onChange={(e) => set({ signatory_title: e.target.value })} /></label>
                  </div>
                  <details className="rounded-lg border border-[#E6E8EE] px-3 py-2" open={!contacts.accounts}>
                    <summary className="cursor-pointer text-[12.5px] text-[#0A2472]">Schedule 1 contacts</summary>
                    <div className="mt-2 flex flex-col gap-2">
                      {CONTACTS.map((c) => (
                        <label key={c.k} className="flex flex-col gap-1"><span className={lbl}>{c.label} {c.k === 'accounts' && req}</span>
                          <input className={inp} value={contacts[c.k] ?? ''} placeholder="Name · email" onChange={(e) => set({ agent_contacts: { ...contacts, [c.k]: e.target.value } })} /></label>
                      ))}
                    </div>
                  </details>
                </div>

                <div className="flex flex-col gap-2.5 border-t border-[#F0F1F4] pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px]">Signature</span>
                    <div className="inline-flex rounded-md bg-[#F1F3F7] p-0.5 text-[12px]">
                      {(['typed', 'drawn'] as const).map((m) => (
                        <button key={m} type="button" onClick={() => setMode(m)} className={`h-7 rounded px-3 ${mode === m ? 'bg-white shadow-sm' : 'text-[#5B6474]'}`}>{m === 'typed' ? 'Type' : 'Draw'}</button>
                      ))}
                    </div>
                  </div>
                  {mode === 'typed' ? (
                    <div className="flex h-[120px] flex-col justify-end rounded-[10px] border border-dashed border-[#C7D0E6] bg-[#FAFBFD] px-4 pb-3">
                      <span className="text-[30px] leading-[38px] text-[#0A2472]" style={{ fontFamily: "'Segoe Script', 'Brush Script MT', cursive" }}>{f.signatory_name || 'Your name'}</span>
                      <span className="border-t border-[#C7D0E6] pt-1 text-[11px] text-[#5B6474]">Typed signature</span>
                    </div>
                  ) : <SignaturePad onChange={setDrawn} />}
                  <label className="flex items-start gap-2 text-[12.5px] leading-[18px] text-[#334155]">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                    I am authorised to sign for {f.agent_legal_name || 'the Agent'} and agree to sign this agreement electronically.
                  </label>
                </div>

                {err && <p className="m-0 rounded-lg bg-[#FEF3F2] px-3 py-2 text-[12.5px] text-[#B42318]">{err}</p>}
                <button type="button" disabled={!ready || busy} onClick={() => void sign()} className="h-11 rounded-lg bg-[#0A2472] text-[14px] text-white disabled:opacity-40">{busy ? 'Signing…' : 'Sign agreement'}</button>
                <p className="m-0 text-[11.5px] text-[#5B6474]">Already signed for UB Freight by {a.ubf_signer_name}. Questions: reply to the email you received.</p>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
