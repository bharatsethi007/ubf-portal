import { ChevronLeft, ChevronRight, FileText, Mail } from 'lucide-react'
import MessageTimeline from '@/pages/inbox/MessageTimeline'
import AttachmentPane from '@/pages/inbox/AttachmentPane'
import { kb } from '@/pages/inbox/EmailParts'
import type { EmailAttachment, InboxDetail } from '@/pages/inbox/inboxApi'

type Props = {
  detail: InboxDetail
  who: string
  atts: EmailAttachment[]
  tab: 'email' | 'files'
  file: number
  onTab: (t: 'email' | 'files') => void
  onFile: (i: number) => void
}

const icon = 'inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-[#5B616E] hover:bg-[#F2F4F7] disabled:opacity-30'

/** Left side of the intake: the email chain or the files, so staff read and key in one view. */
export default function EaIntakeSource({ detail, who, atts, tab, file, onTab, onFile }: Props) {
  const a = atts[file]
  const tabBtn = (id: 'email' | 'files', label: string, Icon: typeof Mail, n?: number) => (
    <button type="button" role="tab" aria-selected={tab === id} onClick={() => onTab(id)}
      className={`inline-flex h-8 w-auto items-center gap-1.5 rounded-md border-0 px-2.5 text-[12.5px] ${tab === id ? 'bg-white font-semibold text-[#14161A] shadow-[0_1px_2px_rgba(16,24,40,.08)]' : 'bg-transparent text-[#5B616E] hover:text-[#14161A]'}`}>
      <Icon size={14} />{label}{n != null ? <span className="bk-mono text-[10.5px] text-[#98A2B3]">{n}</span> : null}
    </button>
  )

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-[#E6E8EE] bg-[#FBFCFD]">
      <div className="flex items-center gap-2 border-b border-[#E6E8EE] bg-white px-3 py-2">
        <div role="tablist" aria-label="Source" className="flex gap-0.5 rounded-lg bg-[#F2F4F7] p-0.5">
          {tabBtn('email', 'Email chain', Mail)}
          {tabBtn('files', 'Files', FileText, atts.length)}
        </div>
        {tab === 'files' && atts.length ? (
          <div className="ml-auto flex min-w-0 items-center gap-1">
            <select aria-label="File" value={file} onChange={(e) => onFile(Number(e.target.value))}
              className="h-[30px] min-w-0 max-w-[320px] rounded-[7px] border border-[#E3E6EB] bg-white px-2 text-[12px]">
              {atts.map((x, i) => <option key={x.id} value={i}>{x.name}</option>)}
            </select>
            <button type="button" className={icon} aria-label="Previous file" title="Previous" disabled={file === 0} onClick={() => onFile(file - 1)}><ChevronLeft size={16} /></button>
            <button type="button" className={icon} aria-label="Next file" title="Next" disabled={file >= atts.length - 1} onClick={() => onFile(file + 1)}><ChevronRight size={16} /></button>
          </div>
        ) : null}
      </div>
      {tab === 'email' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <MessageTimeline messages={detail.messages} who={who} />
        </div>
      ) : atts.length === 0 ? (
        <div className="m-auto text-[12.5px] text-[#6B7280]">No files on this email.</div>
      ) : a ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-[#E6E8EE] bg-white px-3 py-1.5 text-[11px] text-[#6B7280]">{a.name} · {kb(a.size)}</div>
          <AttachmentPane a={a} />
        </div>
      ) : null}
    </section>
  )
}
