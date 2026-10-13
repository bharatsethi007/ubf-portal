import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { signedDownloadUrl, uploadBookingFile } from '@/components/bookings/bookingDocumentsApi'
import { Card } from './eaUi'
import type { DocRow, EaDetail, HistRow, ThreadRow } from './useEaBooking'

const short = (iso: string | null) => (iso ? format(parseISO(iso), 'd MMM') : '')
const ghost = 'w-auto border-0 bg-transparent p-0 text-[11.5px] font-medium text-[#0A2472] hover:underline'

type Props = { b: EaDetail; threads: ThreadRow[]; docs: DocRow[]; hist: HistRow[]; onSaved: () => void }

export default function EaSideRail({ b, threads, docs, hist, onSaved }: Props) {
  return (
    <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
      <Card title="Conversation" aside={<span className="bk-mono text-[10.5px] text-[#6B7280]">{threads[0]?.email_mailbox ?? ''}</span>}>
        {threads.length === 0 ? <p className="m-0 px-4 py-3 text-[12px] text-[#6B7280]">No email thread linked.</p> : (
          <ul className="m-0 list-none py-1">
            {threads.map((t, i) => (
              <li key={t.conversation_id} className={`flex flex-col gap-0.5 px-4 py-2 ${i ? 'border-t border-[#F6F7F9]' : ''}`}>
                <div className="flex justify-between gap-2">
                  <Link to={`/inbox?c=${t.conversation_id}`} className="truncate font-medium text-[#14161A] hover:underline">{t.subject || t.last_sender || 'Conversation'}</Link>
                  <span className="shrink-0 text-[11px] text-[#6B7280]">{short(t.last_message_at)}</span>
                </div>
                <span className="truncate text-[12px] text-[#5B616E]">{t.last_sender ? `${t.last_sender}: ` : ''}{t.last_preview}</span>
              </li>
            ))}
          </ul>
        )}
        {threads[0] ? (
          <div className="border-t border-[#F1F2F5] px-4 py-2.5">
            <Link to={`/inbox?c=${threads[0].conversation_id}`} className="text-[12px] font-medium text-[#0A2472] hover:underline">Reply in inbox</Link>
          </div>
        ) : null}
      </Card>

      <Docs b={b} docs={docs} onSaved={onSaved} />

      <Card title="Activity">
        <ol className="m-0 flex list-none flex-col gap-2.5 px-4 pb-3.5 pt-2.5">
          {hist.length === 0 ? <li className="text-[12px] text-[#6B7280]">No changes yet.</li> : null}
          {hist.map((h) => (
            <li key={h.id} className="grid grid-cols-[52px_1fr] gap-2.5 text-[12px]">
              <span className="text-[11px] text-[#6B7280]">{short(h.created_at)}</span>
              <span className="leading-snug text-[#14161A]">
                {describe(h)} <span className="text-[#6B7280]">· {h.actor_name ?? 'System'}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </aside>
  )
}

function describe(h: HistRow) {
  if (h.action === 'insert' || h.action === 'created') return 'Booking created'
  const f = (h.field ?? '').replace(/_/g, ' ')
  return h.new_value ? `${f} → ${h.new_value.length > 40 ? `${h.new_value.slice(0, 40)}…` : h.new_value}` : `${f} cleared`
}

function Docs({ b, docs, onSaved }: { b: EaDetail; docs: DocRow[]; onSaved: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const f of Array.from(files)) await uploadBookingFile(f, b.id, b.account_id ?? b.shipper_account_id ?? 'UBF')
      toast.success('Uploaded')
      onSaved()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function open(d: DocRow) {
    try { window.open(await signedDownloadUrl(d.storage_path), '_blank', 'noopener') } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <Card title="Documents" aside={<button type="button" className={ghost} disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : 'Upload'}</button>}>
      <input ref={input} type="file" multiple hidden onChange={(e) => void upload(e.target.files)} />
      {docs.length === 0 ? <p className="m-0 px-4 py-3 text-[12px] text-[#6B7280]">No documents yet.</p> : (
        <ul className="m-0 list-none py-1">
          {docs.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => void open(d)} className="flex w-full items-center gap-2.5 border-0 bg-transparent px-4 py-2 text-left text-[12.5px] hover:bg-[#F8F9FB]">
                <FileText size={14} className="shrink-0 text-[#98A2B3]" />
                <span className="min-w-0 flex-1 truncate text-[#14161A]">{d.file_name}</span>
                <span className="shrink-0 text-[11px] text-[#6B7280]">{d.uploaded_via ?? 'staff'} · {short(d.created_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
