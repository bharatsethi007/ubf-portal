import { useEffect, useRef, useState } from 'react'
import { Eye, FileText, FileImage, File as FileIcon, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/supabase'
import { fetchBookingDocumentRows, signedDownloadUrl, uploadTaggedBookingFile } from '../documents/bookingRecordDocumentsApi'
import type { BookingDocumentRow } from '../documents/documentTypes'

type Props = {
  bookingId: string; accountId: string | null
  selected: Set<string>; onSelected: (s: Set<string>) => void
  onDocs?: (docs: BookingDocumentRow[]) => void
}

export const MAX_ATTACH_BYTES = 30 * 1024 * 1024

export function fmtSize(n: number | null | undefined): string {
  const b = Number(n ?? 0)
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function iconFor(d: BookingDocumentRow) {
  const n = d.file_name.toLowerCase()
  if (d.mime_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(n)) return FileImage
  if (d.mime_type === 'application/pdf' || n.endsWith('.pdf')) return FileText
  return FileIcon
}

export default function AttachmentPanel({ bookingId, accountId, selected, onSelected, onDocs }: Props) {
  const [docs, setDocs] = useState<BookingDocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let live = true
    setLoading(true)
    fetchBookingDocumentRows(bookingId)
      .then((r) => { if (live) { setDocs(r); onDocs?.(r) } })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load documents'))
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId])

  const toggle = (id: string) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); onSelected(n) }
  const allOn = docs.length > 0 && docs.every((d) => selected.has(d.id))
  const total = docs.filter((d) => selected.has(d.id)).reduce((s, d) => s + Number(d.size_bytes ?? 0), 0)

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    const { data: auth } = await supabase.auth.getUser()
    const added: BookingDocumentRow[] = []
    for (const f of Array.from(files)) {
      try { added.push(await uploadTaggedBookingFile(f, bookingId, accountId?.trim() || 'unassigned', null, auth.user?.id ?? null)) }
      catch (e) { toast.error(`${f.name}: ${e instanceof Error ? e.message : 'upload failed'}`) }
    }
    const next = [...added, ...docs]
    setDocs(next); onDocs?.(next)
    onSelected(new Set([...selected, ...added.map((a) => a.id)]))
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <aside className="flex min-h-0 w-[320px] shrink-0 flex-col border-l border-slate-100 bg-white">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div>
          <div className="text-[13px] font-semibold text-slate-800">Job documents</div>
          <div className="text-[11.5px] text-slate-500">{selected.size ? `${selected.size} attached · ${fmtSize(total)}` : 'Tick to attach'}</div>
        </div>
        <div className="flex items-center gap-1">
          {docs.length > 1 && (
            <button type="button" className="text-link text-[12px]" onClick={() => onSelected(allOn ? new Set() : new Set(docs.map((d) => d.id)))}>
              {allOn ? 'Clear' : 'All'}
            </button>
          )}
          <button type="button" title="Add file to job" aria-label="Add file to job" onClick={() => fileRef.current?.click()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          </button>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => void upload(e.target.files)} />
        </div>
      </div>
      {total > MAX_ATTACH_BYTES && <div className="mx-4 mb-2 rounded-md bg-red-50 px-2 py-1 text-[11.5px] text-red-700">Over 30 MB. Untick some files.</div>}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files) }}>
        {loading ? (
          [0, 1, 2].map((i) => <div key={i} className="mx-2 my-2 h-11 animate-pulse rounded-md bg-slate-100" />)
        ) : docs.length === 0 ? (
          <div className="mx-2 mt-6 rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-[12.5px] text-slate-500">
            No documents on this job. Drop files here to add.
          </div>
        ) : docs.map((d) => {
          const Icon = iconFor(d), on = selected.has(d.id)
          return (
            <label key={d.id} className={`group flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 ${on ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(d.id)} className="h-4 w-4 accent-blue-600" />
              <Icon size={18} className={on ? 'text-blue-600' : 'text-slate-400'} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-slate-800" title={d.file_name}>{d.file_name}</span>
                <span className="block truncate text-[11px] text-slate-500">{[d.tag_name, fmtSize(d.size_bytes)].filter(Boolean).join(' · ')}</span>
              </span>
              <button type="button" title="Preview" aria-label={`Preview ${d.file_name}`}
                onClick={(e) => { e.preventDefault(); void signedDownloadUrl(d.storage_path).then((u) => window.open(u, '_blank', 'noopener,noreferrer')) }}
                className="invisible inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-white group-hover:visible">
                <Eye size={14} />
              </button>
            </label>
          )
        })}
      </div>
    </aside>
  )
}
