import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileUp, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '../../../supabase'
import type { AgentRow } from '../agentsApi'
import { OFFICES, addYears } from './agreementModel'

type Props = { agent: AgentRow; open: boolean; onOpenChange: (o: boolean) => void; onDone: (id: string) => void }

const MAX_MB = 25

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('agreement-sign', { body })
  const err = (data as { error?: string } | null)?.error
  if (err) throw new Error(err)
  if (error) {
    const ctx = (error as { context?: Response }).context
    const j = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null
    throw new Error(j?.error ?? error.message)
  }
  return data as T
}

/** Admins and Pricing Leads: file an existing signed agreement (old PDF) with manual dates. */
export default function UploadAgreementDialog({ agent, open, onOpenChange, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [eff, setEff] = useState('')
  const [exp, setExp] = useState('')
  const [signed, setSigned] = useState('')
  const [signatory, setSignatory] = useState('')
  const [ubfSigner, setUbfSigner] = useState('')
  const [offices, setOffices] = useState<string[]>(['NZ', 'FJ', 'AU'])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setFile(null); setEff(''); setExp(''); setSigned(''); setSignatory(''); setUbfSigner(''); setNotes('')
    setOffices(['NZ', 'FJ', 'AU'])
  }, [open])

  function pick(f: File | undefined) {
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { toast.error('PDF files only'); return }
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(`Max ${MAX_MB} MB`); return }
    setFile(f)
  }

  const bad = !file || !eff || !exp || exp <= eff || !offices.length

  async function submit() {
    if (bad || !file) return
    setBusy(true)
    try {
      const { key, url } = await call<{ key: string; url: string }>({ op: 'import_url', agent_id: agent.id })
      const put = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': 'application/pdf' } })
      if (!put.ok) throw new Error(`Upload failed (${put.status})`)
      const r = await call<{ id: string; ref: string }>({
        op: 'import', agent_id: agent.id, key, file_name: file.name, effective_date: eff, expiry_date: exp,
        signed_date: signed || null, signatory_name: signatory, ubf_signer_name: ubfSigner, offices, notes,
      })
      toast.success(`Filed as ${r.ref}`)
      onOpenChange(false)
      onDone(r.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const lbl = 'text-[11.5px] text-[#5B6474]'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload signed agreement</DialogTitle>
          <p className="m-0 text-[12px] text-[#5B6474]">{agent.name} · for agreements signed outside the portal</p>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <button type="button" onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]) }}
            className="flex flex-col items-center gap-1.5 rounded-[10px] border border-dashed border-[#C7D0E6] bg-[#F8FAFF] px-4 py-6 text-center">
            <FileUp size={20} className="text-[#0A2472]" />
            {file
              ? <><span className="text-[13px] text-[#0F172A]">{file.name}</span><span className={lbl}>{(file.size / 1024 / 1024).toFixed(1)} MB · click to change</span></>
              : <><span className="text-[13px] text-[#0F172A]">Drop the signed PDF here or click to choose</span><span className={lbl}>PDF, up to {MAX_MB} MB</span></>}
          </button>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span className={lbl}>Start date</span>
              <input type="date" className="input" value={eff} onChange={(e) => { setEff(e.target.value); if (!exp && e.target.value) setExp(addYears(e.target.value, 3)) }} /></label>
            <label className="flex flex-col gap-1"><span className={lbl}>Expiry date</span>
              <input type="date" className="input" value={exp} min={eff || undefined} onChange={(e) => setExp(e.target.value)} /></label>
          </div>
          {eff && exp && exp <= eff && <span className="text-[12px] text-[#B42318]">Expiry must be after the start date.</span>}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span className={lbl}>Agent signatory (optional)</span><input className="input" value={signatory} onChange={(e) => setSignatory(e.target.value)} /></label>
            <label className="flex flex-col gap-1"><span className={lbl}>Signed for UB Freight by (optional)</span><input className="input" value={ubfSigner} onChange={(e) => setUbfSigner(e.target.value)} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span className={lbl}>Date signed (optional)</span><input type="date" className="input" value={signed} onChange={(e) => setSigned(e.target.value)} /></label>
            <div className="flex flex-col gap-1"><span className={lbl}>Offices covered</span>
              <div className="flex h-9 items-center gap-3">
                {OFFICES.map((o) => (
                  <label key={o.code} className="inline-flex items-center gap-1.5 text-[12.5px]">
                    <input type="checkbox" checked={offices.includes(o.code)}
                      onChange={(e) => setOffices((l) => (e.target.checked ? [...l, o.code] : l.filter((x) => x !== o.code)))} />
                    {o.code}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <label className="flex flex-col gap-1"><span className={lbl}>Notes (optional)</span>
            <textarea className="input" rows={3} style={{ height: 76, resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Signed 2023 version, exclusive for PNG" /></label>
          <span className={lbl}>Filed as signed. Status, pills and expiry reminders use the dates above.</span>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={busy || bad} onClick={() => void submit()}><Upload size={14} /> {busy ? 'Uploading…' : 'Upload and file'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
