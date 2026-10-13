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
import MailList, { type MailTab } from './MailList'
import MailPreview from './MailPreview'
import type { MailboxConfig, MailRecord } from './mailTypes'

type Props = { box: MailboxConfig; record?: MailRecord; onClose: () => void; onChanged: () => void }

const COLS = 'id, subject, who, contact_name, contact_email, account_id, team, assignee_id, last_message_at, last_preview, last_channel, last_sender, reply_due_at, email_mailbox, channels, contact_type'

// Threads linked to the record, read directly: inbox_list is capped, so older linked threads would be missed.
async function recordThreadIds(r: MailRecord): Promise<string[]> {
  if (r.kind === 'quote') {
    const { data } = await supabase.from('inbox_conversations').select('id').eq('quote_id', r.id)
    return (data ?? []).map((x) => x.id as string)
  }
  const [links, legacy] = await Promise.all([
    supabase.from('booking_threads').select('conversation_id').eq('booking_id', r.id),
    supabase.from('inbox_conversations').select('id').eq('booking_id', r.id),
  ])
  return [...new Set([...(links.data ?? []).map((x) => x.conversation_id as string), ...(legacy.data ?? []).map((x) => x.id as string)])]
}

/** Shared mailbox over any screen: list, docked doc preview, full thread (reply, create booking or quote, link). */
export default function MailPanel({ box, record, onClose, onChanged }: Props) {
  const [tab, setTab] = useState<MailTab>(record ? 'job' : 'all')
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
      if (tab === 'job' && record) {
        const ids = await recordThreadIds(record)
        setJobIds(new Set(ids))
        if (!ids.length) { setRows([]); return }
        const { data, error } = await supabase.from('inbox_conversations').select(COLS).in('id', ids).order('last_message_at', { ascending: false })
        if (error) throw new Error(error.message)
        const needle = debounced.toLowerCase()
        const ref = record.ref ?? null
        setRows(((data ?? []) as Record<string, unknown>[]).map((c) => ({
          ...(c as unknown as InboxRow),
          who: (c.who as string) ?? (c.contact_name as string) ?? (c.contact_email as string) ?? 'Unknown',
          account_name: null, assignee_name: null, assignee_initials: null, wa_id: null,
          quote_no: record.kind === 'quote' ? ref : null, booking_ref: record.kind === 'booking' ? ref : null,
          unread: 0, channels: (c.channels as InboxRow['channels']) ?? [],
        })).filter((r) => !needle || [r.who, r.subject, r.last_preview].some((x) => x?.toLowerCase().includes(needle))))
      } else {
        setRows(await fetchList(tab === 'job' ? 'all' : tab, null, box.mailbox, debounced))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load mailbox')
    } finally {
      setLoading(false)
    }
  }, [tab, debounced, record, box.mailbox])

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

  const fallback = record?.kind === 'quote' ? 'This quote' : 'This job'
  const tabs = useMemo(() => [
    ...(record ? [{ id: 'job' as const, label: record.ref ?? fallback, n: tab === 'job' ? rows.length : jobIds.size || undefined }] : []),
    { id: 'all' as const, label: 'Open' },
    { id: 'mine' as const, label: 'Mine' },
    { id: 'unassigned' as const, label: 'Unassigned' },
  ], [record, fallback, tab, rows.length, jobIds.size])

  const onPreview = useCallback((p: { items: EmailAttachment[]; index: number }) => setPreview(p), [])
  const empty = record?.kind === 'quote' ? 'No email threads linked to this quote.' : 'No email threads linked to this job.'

  return (
    <div className="fixed inset-0 z-[60] bg-[rgba(15,23,42,.18)]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-label={box.title}
        className="ibx absolute bottom-3 right-3 top-3 flex-col overflow-hidden rounded-xl shadow-[0_24px_64px_rgba(15,23,42,.22)]"
        style={{ margin: 0, height: 'auto', minHeight: 0, width: 'min(1560px, calc(100vw - 24px))', display: 'flex', flexDirection: 'column', borderTop: 0 }}>
        <header className="flex shrink-0 items-center gap-3 border-b border-[#E6E8EE] bg-white px-4 py-2.5">
          <span className="text-[13.5px] font-semibold text-[#14161A]">{box.title}</span>
          <span className="bk-mono text-[11px] text-[#6B7280]">{box.mailbox}</span>
          <span className="flex-1" />
          <Link to={`/inbox?team=${encodeURIComponent(box.mailbox)}${selected ? `&c=${selected}` : ''}`} onClick={onClose}
            className="inline-flex items-center gap-1 text-[12px] text-[#0A2472] hover:underline">Open full inbox <ExternalLink size={12} /></Link>
          <button type="button" aria-label="Close mailbox" title="Close" onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-[#5B616E] hover:bg-[#F2F4F7]"><X size={16} /></button>
        </header>
        <div className="flex min-h-0 flex-1">
          <MailList rows={rows} tab={tab} tabs={tabs} q={q} selected={selected} loading={loading} empty={empty}
            onTab={(t) => { setTab(t); setSelected(null); setDetail(null); setPreview(null) }} onQ={setQ} onPick={pick} />
          {preview ? <MailPreview items={preview.items} index={preview.index} docsToJob={!!box.docsToJob}
            onIndex={(i) => setPreview({ ...preview, index: i })} onClose={() => setPreview(null)} /> : null}
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
