// Renders one email attachment: PDF/text/images inline, Office via Microsoft's viewer. Used by the popup viewer and the booking side panel.
import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import type { EmailAttachment } from './inboxApi'
import { attachmentUrl } from './EmailParts'

export const kindOf = (a: EmailAttachment) => {
  const n = a.name.toLowerCase()
  if (n.endsWith('.pdf') || /pdf/i.test(a.content_type ?? '')) return 'pdf'
  if (/\.(png|jpe?g|gif|webp|bmp)$/.test(n)) return 'img'
  if (/\.(docx?|xlsx?|pptx?)$/.test(n)) return 'office'
  if (/\.(txt|csv)$/.test(n)) return 'text'
  return 'none'
}

export async function downloadAttachment(a: EmailAttachment) {
  const u = await attachmentUrl(a, true)
  if (u) window.location.href = u
}

export default function AttachmentPane({ a }: { a: EmailAttachment }) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const kind = kindOf(a)

  useEffect(() => {
    let live = true
    let blobUrl: string | null = null
    setUrl(null); setErr('')
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
    return () => { live = false; if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [a])

  return (
    <div className="ibx-viewer__body">
      {err ? <div className="ibx-empty">{err}</div> : !url ? <div className="ibx-empty">Loading…</div>
        : kind === 'pdf' || kind === 'text' ? <iframe title={a.name} src={url} />
        : kind === 'img' ? <img src={url} alt={a.name} />
        : kind === 'office' ? <iframe title={a.name} src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`} />
        : (
          <div className="ibx-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            No preview for this file type.
            <button type="button" className="ibx-btn ibx-btn--primary" onClick={() => void downloadAttachment(a)}><Download size={15} />Download</button>
          </div>
        )}
    </div>
  )
}
