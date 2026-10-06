// Attachment preview in a popup on the same screen. PDF + images inline, Office files via Microsoft's viewer.
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, FilePlus2, X } from 'lucide-react'
import type { EmailAttachment } from './inboxApi'
import { attachmentUrl, inboxAction, kb } from './EmailParts'

type Props = { items: EmailAttachment[]; index: number; onClose: () => void }

const kindOf = (a: EmailAttachment) => {
  const n = a.name.toLowerCase()
  if (n.endsWith('.pdf') || /pdf/i.test(a.content_type ?? '')) return 'pdf'
  if (/\.(png|jpe?g|gif|webp|bmp)$/.test(n)) return 'img'
  if (/\.(docx?|xlsx?|pptx?)$/.test(n)) return 'office'
  if (/\.(txt|csv)$/.test(n)) return 'text'
  return 'none'
}

export default function AttachmentViewer({ items, index, onClose }: Props) {
  const [i, setI] = useState(index)
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const a = items[i]
  const kind = a ? kindOf(a) : 'none'

  useEffect(() => {
    let live = true
    setUrl(null); setErr('')
    let blobUrl: string | null = null
    if (a) {
      attachmentUrl(a).then(async (u) => {
        // Email PDFs are often stored as octet-stream; re-type them so the browser shows instead of downloading.
        if (u && (kindOf(a) === 'pdf' || kindOf(a) === 'text')) {
          try {
            const b = await (await fetch(u)).blob()
            blobUrl = URL.createObjectURL(new Blob([b], { type: kindOf(a) === 'pdf' ? 'application/pdf' : 'text/plain' }))
            if (live) setUrl(blobUrl)
            return
          } catch { /* CORS blocked: fall back to the signed link */ }
        }
        if (live) setUrl(u)
      }).catch((e) => { if (live) setErr(e instanceof Error ? e.message : 'Could not load file') })
    }
    return () => { live = false; if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [a])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((x) => Math.min(items.length - 1, x + 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [items.length, onClose])

  if (!a) return null

  async function download() {
    const u = await attachmentUrl(a, true)
    if (u) window.location.href = u
  }

  return (
    <div className="ibx-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ibx-viewer" role="dialog" aria-label={a.name}>
        <header className="ibx-viewer__head">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="ibx-ellip" style={{ fontSize: 14, fontWeight: 500 }}>{a.name}</div>
            <div style={{ fontSize: 12, color: '#605E5C' }}>{kb(a.size)}{items.length > 1 ? ` · ${i + 1} of ${items.length}` : ''}</div>
          </div>
          {items.length > 1 ? (
            <>
              <button type="button" className="ibx-mail__icon" aria-label="Previous" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft size={18} /></button>
              <button type="button" className="ibx-mail__icon" aria-label="Next" disabled={i === items.length - 1} onClick={() => setI(i + 1)}><ChevronRight size={18} /></button>
            </>
          ) : null}
          <button type="button" className="ibx-btn" onClick={() => { onClose(); inboxAction('job', { mode: 'docs', attachmentIds: [a.id] }) }}>
            <FilePlus2 size={15} />Save to job
          </button>
          <button type="button" className="ibx-btn" onClick={() => void download()}><Download size={15} />Download</button>
          <button type="button" className="ibx-mail__icon" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="ibx-viewer__body">
          {err ? <div className="ibx-empty">{err}</div> : !url ? <div className="ibx-empty">Loading…</div>
            : kind === 'pdf' || kind === 'text' ? <iframe title={a.name} src={url} />
            : kind === 'img' ? <img src={url} alt={a.name} />
            : kind === 'office' ? <iframe title={a.name} src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`} />
            : (
              <div className="ibx-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                No preview for this file type.
                <button type="button" className="ibx-btn ibx-btn--primary" onClick={() => void download()}><Download size={15} />Download</button>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
