// Attachment preview in a popup on the same screen. PDF + images inline, Office files via Microsoft's viewer.
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, FilePlus2, X } from 'lucide-react'
import type { EmailAttachment } from './inboxApi'
import { inboxAction, kb } from './EmailParts'
import AttachmentPane, { downloadAttachment } from './AttachmentPane'

type Props = { items: EmailAttachment[]; index: number; onClose: () => void }

export default function AttachmentViewer({ items, index, onClose }: Props) {
  const [i, setI] = useState(index)
  const a = items[i]

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

  const download = () => void downloadAttachment(a)

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
          <button type="button" className="ibx-btn" onClick={download}><Download size={15} />Download</button>
          <button type="button" className="ibx-mail__icon" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>
        <AttachmentPane a={a} />
      </div>
    </div>
  )
}
