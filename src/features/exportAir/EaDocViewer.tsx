import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { signedDownloadUrl } from '@/components/bookings/bookingDocumentsApi'
import type { DocRow } from './useEaBooking'

type Props = { docs: DocRow[]; index: number; onIndex: (i: number) => void; onClose: () => void }

const kindOf = (n: string) => {
  const s = n.toLowerCase()
  if (s.endsWith('.pdf')) return 'pdf'
  if (/\.(png|jpe?g|gif|webp|bmp)$/.test(s)) return 'img'
  if (/\.(docx?|xlsx?|pptx?)$/.test(s)) return 'office'
  if (/\.(txt|csv)$/.test(s)) return 'text'
  return 'none'
}
const icon = 'inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-[#5B616E] hover:bg-[#F2F4F7] disabled:opacity-30'

/** Booking document docked on the right. No backdrop, so the booking stays editable beside it. */
export default function EaDocViewer({ docs, index, onIndex, onClose }: Props) {
  const d = docs[index]
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!d) return
    let live = true
    let blob: string | null = null
    setUrl(null); setErr('')
    signedDownloadUrl(d.storage_path).then(async (u) => {
      const k = kindOf(d.file_name)
      if (k === 'pdf' || k === 'text') {
        try {
          const b = await (await fetch(u)).blob()
          blob = URL.createObjectURL(new Blob([b], { type: k === 'pdf' ? 'application/pdf' : 'text/plain' }))
          if (live) setUrl(blob)
          return
        } catch { /* CORS: use the signed link */ }
      }
      if (live) setUrl(u)
    }).catch((e) => { if (live) setErr(e instanceof Error ? e.message : 'Could not load file') })
    return () => { live = false; if (blob) URL.revokeObjectURL(blob) }
  }, [d])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  if (!d) return null
  const k = kindOf(d.file_name)
  return (
    <aside role="dialog" aria-label={`Document ${d.file_name}`}
      className="fixed bottom-3 right-3 top-3 z-[75] flex w-[min(760px,46vw)] min-w-[420px] flex-col overflow-hidden rounded-xl border border-[#E6E8EE] bg-white shadow-[-12px_0_40px_rgba(15,23,42,.18)] duration-200 animate-in fade-in-0 slide-in-from-right-6 motion-reduce:animate-none">
      <header className="flex items-center gap-1.5 border-b border-[#E6E8EE] px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium text-[#14161A]" title={d.file_name}>{d.file_name}</div>
          <div className="text-[11px] text-[#6B7280]">{d.uploaded_via ?? 'staff'}{docs.length > 1 ? ` · ${index + 1} of ${docs.length}` : ''}</div>
        </div>
        <button type="button" className={icon} title="Previous" aria-label="Previous document" disabled={index === 0} onClick={() => onIndex(index - 1)}><ChevronLeft size={16} /></button>
        <button type="button" className={icon} title="Next" aria-label="Next document" disabled={index >= docs.length - 1} onClick={() => onIndex(index + 1)}><ChevronRight size={16} /></button>
        <button type="button" className={icon} title="Download" aria-label="Download" onClick={() => void signedDownloadUrl(d.storage_path).then((u) => window.open(u, '_blank', 'noopener'))}><Download size={15} /></button>
        <button type="button" className={icon} title="Close" aria-label="Close document" onClick={onClose}><X size={16} /></button>
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#F3F2F1]">
        {err ? <span className="text-[12px] text-[#B42318]">{err}</span>
          : !url ? <span className="text-[12px] text-[#6B7280]">Loading…</span>
            : k === 'pdf' || k === 'text' ? <iframe title={d.file_name} src={url} className="h-full w-full border-0 bg-white" />
              : k === 'img' ? <img src={url} alt={d.file_name} className="max-h-full max-w-full object-contain" />
                : k === 'office' ? <iframe title={d.file_name} src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`} className="h-full w-full border-0 bg-white" />
                  : <button type="button" onClick={() => window.open(url, '_blank', 'noopener')} className="inline-flex h-[30px] w-auto items-center gap-1.5 rounded-[7px] border border-[#0A2472] bg-[#0A2472] px-3 text-[12px] font-medium text-white"><Download size={14} /> Download to view</button>}
      </div>
    </aside>
  )
}
