import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/supabase'
import '@/pages/inbox/inbox.css'
import ThreadView from '@/pages/inbox/ThreadView'
import {
  fetchDetail, fetchList, fetchStaff, markRead,
  type EmailAttachment, type InboxDetail, type InboxRow, type StaffOption,
} from '@/pages/inbox/inboxApi'
import EaMailList, { type MailTab } from './EaMailList'
import EaMailPreview from './EaMailPreview'

export const EA_MAILBOX = 'exportair.nz@ubfreight.com'

type Props = { bookingId?: string; bookingRef?: string; onClose: () => void; onChanged: () => void }

/** Export air mailbox over any EA screen: list, docked doc preview, full thread (reply, create booking, add docs to job). */
export default function EaMailPanel({ bookingId, bookingRef, onClose, onChanged }: Props) {
  const [tab, setTab] = useState<MailTab>(bookingId ? 'job' : 'all')
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [rows, setRows] = useState<InboxRow[]>([])
  const [jobIds, setJobIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<InboxDetail | null>(null)
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [me, setMe] = useState('')
  const [preview, setPreview] = useState<{ items: EmailAttachment[]; index: number } | null>(null)

  useEffect(() => { const t = window.setTimeout(() => setDebounced(q.trim()), 250); return () => window.clearTimeout(t) }, [q])
  useEffect(() => {
    void fetchStaff().then((s) => setStaff(s ?? [])).catch(() => {})
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? ''))
  }, [])

  const loadList = useCallback(async () => {
    try {
      if (tab === 'job') {
        // Read the job's threads directly: inbox_list is capped, so older linked threads would be missed.
        const [links, legacy] = await Promise.all([
          supabase.from('booking_threads').select('conversation_id').eq('booking_id', bookingId ?? ''),
          supabase.from('inbox_conversations').select('id').eq('booking_id', bookingId ?? ''),
        ])
        const ids = [...new Set([...(links.data ?? []).map((x) => x.conversation_id as string), ...(legacy.data ?? []).map((x) => x.id as string)])]
        setJobIds(new Set(ids))
        if (!ids.length) { setRows([]); return }
        const { data, error } = await supabase.from('inbox_conversations')
          .select('id, subject, who, contact_name, contact_email, account_id, team, assignee_id, last_message_at, last_preview, last_channel, last_sender, reply_due_at, email_mailbox, channels, contact_type')
          .in('id', ids).order('last_message_at', { ascending: false })
        if (error) throw new Error(error.message)
        const needle = debounced.toLowerCase()
        setRows(((data ?? []) as Record<string, unknown>[]).map((c) => ({
          ...(c as unknown as InboxRow),
          who: (c.who as string) ?? (c.contact_name as string) ?? (c.contact_email as string) ?? 'Unknown',
          account_name: null, assignee_name: null, assignee_initials: null, wa_id: null, quote_no: null,
          booking_ref: bookingRef ?? null, unread: 0, channels: (c.channels as InboxRow['channels']) ?? [],
        })).filter((r) => !needle || [r.who, r.subject, r.last_preview].some((x) => x?.toLowerCase().includes(needle))))
      } else {
        setRows(await fetchList(tab, null, EA_MAILBOX, debounced))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load mailbox')
    } finally {
      setLoading(false)
    }
  }, [tab, debounced, bookingId, bookingRef])

  useEffect(() => { setLoading(true); void loadList() }, [loadList])
  useEffect(() => { const t = window.setInterval(() => void loadList(), 60_000); return () => window.clearInterval(t) }, [loadList])

  const loadDetail = useCallback(async (id: string, read = true) => {
    try {
      setDetail(await fetchDetail(id))
      if (read) await markRead(id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load conversation')
    }
  }, [])

  function pick(id: string) {
    setSelected(id)
    setPreview(null)
    void loadDetail(id).then(() => loadList())
  }

  const refresh = useCallback(() => {
    if (selected) void loadDetail(selected, false)
    void loadList()
    onChanged()
  }, [selected, loadDetail, loadList, onChanged])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.ibx-modal-back')) { if (preview) setPreview(null); else onClose() } }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [preview, onClose])

  const tabs = useMemo(() => [
    ...(bookingId ? [{ id: 'job' as const, label: bookingRef ?? 'This job', n: tab === 'job' ? rows.length : jobIds.size || undefined }] : []),
    { id: 'all' as const, label: 'Open' },
    { id: 'mine' as const, label: 'Mine' },
    { id: 'unassigned' as const, label: 'Unassigned' },
  ], [bookingId, bookingRef, tab, rows.length, jobIds.size])

  const onPreview = useCallback((p: { items: EmailAttachment[]; index: number }) => setPreview(p), [])

  return (
    <div className="fixed inset-0 z-[60] bg-[rgba(15,23,42,.18)]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-label="Export air mailbox"
        className="ibx absolute bottom-3 right-3 top-3 flex-col overflow-hidden rounded-xl shadow-[0_24px_64px_rgba(15,23,42,.22)]"
        style={{ margin: 0, height: 'auto', minHeight: 0, width: 'min(1560px, calc(100vw - 24px))', display: 'flex', flexDirection: 'column', borderTop: 0 }}>
        <header className="flex shrink-0 items-center gap-3 border-b border-[#E6E8EE] bg-white px-4 py-2.5">
          <span className="text-[13.5px] font-semibold text-[#14161A]">Export air mail</span>
          <span className="bk-mono text-[11px] text-[#6B7280]">{EA_MAILBOX}</span>
          <span className="flex-1" />
          <Link to={`/inbox?team=${encodeURIComponent(EA_MAILBOX)}${selected ? `&c=${selected}` : ''}`} onClick={onClose}
            className="inline-flex items-center gap-1 text-[12px] text-[#0A2472] hover:underline">Open full inbox <ExternalLink size={12} /></Link>
          <button type="button" aria-label="Close mailbox" title="Close" onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-[#5B616E] hover:bg-[#F2F4F7]"><X size={16} /></button>
        </header>
        <div className="flex min-h-0 flex-1">
          <EaMailList rows={rows} tab={tab} tabs={tabs} q={q} selected={selected} loading={loading}
            onTab={(t) => { setTab(t); setSelected(null); setDetail(null); setPreview(null) }} onQ={setQ} onPick={pick} />
          {preview ? <EaMailPreview items={preview.items} index={preview.index} onIndex={(i) => setPreview({ ...preview, index: i })} onClose={() => setPreview(null)} /> : null}
          <div className="flex min-h-0 min-w-0 [&_.ibx-msgs]:min-h-0" style={preview ? { flex: '0 0 600px' } : { flex: '1 1 auto' }}>
            {detail && detail.conversation.id === selected
              ? <ThreadView detail={detail} staff={staff} me={me} onChanged={refresh} onPreview={onPreview} />
              : <div className="ibx-empty m-auto text-[12.5px] text-[#6B7280]">{selected ? 'Loading conversation…' : 'Pick an email. Attachments open on the left.'}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
