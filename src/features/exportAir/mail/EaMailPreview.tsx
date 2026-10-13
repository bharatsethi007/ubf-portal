import { ChevronLeft, ChevronRight, Download, FilePlus2, X } from 'lucide-react'
import AttachmentPane, { downloadAttachment } from '@/pages/inbox/AttachmentPane'
import { inboxAction, kb } from '@/pages/inbox/EmailParts'
import type { EmailAttachment } from '@/pages/inbox/inboxApi'

type Props = { items: EmailAttachment[]; index: number; onIndex: (i: number) => void; onClose: () => void }

const icon = 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-[#5B616E] hover:bg-[#F2F4F7] disabled:opacity-30'

/** Docked document preview, left of the thread. Same viewer as the inbox popup. */
export default function EaMailPreview({ items, index, onIndex, onClose }: Props) {
  const a = items[index]
  if (!a) return null
  return (
    <section aria-label={`Preview ${a.name}`} className="flex min-w-0 flex-1 flex-col border-r border-[#E6E8EE] bg-white">
      <header className="flex items-center gap-1.5 border-b border-[#E6E8EE] px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium text-[#14161A]" title={a.name}>{a.name}</div>
          <div className="text-[11px] text-[#6B7280]">{kb(a.size)}{items.length > 1 ? ` · ${index + 1} of ${items.length}` : ''}</div>
        </div>
        {items.length > 1 ? (
          <>
            <button type="button" className={icon} title="Previous" aria-label="Previous document" disabled={index === 0} onClick={() => onIndex(index - 1)}><ChevronLeft size={16} /></button>
            <button type="button" className={icon} title="Next" aria-label="Next document" disabled={index === items.length - 1} onClick={() => onIndex(index + 1)}><ChevronRight size={16} /></button>
          </>
        ) : null}
        <button type="button" onClick={() => inboxAction('job', { mode: 'docs', attachmentIds: [a.id] })}
          className="inline-flex h-7 w-auto items-center gap-1.5 rounded-md border border-[#E3E6EB] bg-white px-2.5 text-[12px] font-medium text-[#0A2472] hover:bg-[#F6F7F9]">
          <FilePlus2 size={14} /> Add to job
        </button>
        <button type="button" className={icon} title="Download" aria-label="Download document" onClick={() => void downloadAttachment(a)}><Download size={15} /></button>
        <button type="button" className={icon} title="Close preview" aria-label="Close preview" onClick={onClose}><X size={15} /></button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <AttachmentPane a={a} />
      </div>
    </section>
  )
}
