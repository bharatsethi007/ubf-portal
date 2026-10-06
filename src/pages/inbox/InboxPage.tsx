// Unified inbox: WhatsApp, Portal and shared mailboxes in one place (WeChat later). Realtime via inbox_* tables.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../supabase'
import ConversationList from './ConversationList'
import InboxNav from './InboxNav'
import ThreadView from './ThreadView'
import {
  fetchCounts, fetchDetail, fetchList, fetchStaff, markRead,
  type Channel, type InboxCounts, type InboxDetail, type InboxRow, type StaffOption, type View,
} from './inboxApi'
import './inbox.css'

const VIEWS: View[] = ['mine', 'unassigned', 'unknown', 'all', 'snoozed', 'closed', 'ignored']

export default function InboxPage() {
  const [params, setParams] = useSearchParams()
  const view = (VIEWS.includes(params.get('view') as View) ? params.get('view') : 'all') as View
  const channel = (params.get('channel') as Channel | null) || null
  const team = params.get('team') || null
  const selectedId = params.get('c')

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [rows, setRows] = useState<InboxRow[]>([])
  const [counts, setCounts] = useState<InboxCounts | null>(null)
  const [detail, setDetail] = useState<InboxDetail | null>(null)
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [me, setMe] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const selRef = useRef<string | null>(selectedId)
  selRef.current = selectedId

  const patch = useCallback((next: Record<string, string | null>) => {
    setParams((p) => {
      const q = new URLSearchParams(p)
      Object.entries(next).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k)))
      return q
    }, { replace: true })
  }, [setParams])

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t) }, [search])

  const loadList = useCallback(async () => {
    try {
      const [l, c] = await Promise.all([fetchList(view, channel, team, debounced), fetchCounts()])
      setRows(l ?? []); setCounts(c); setError('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load inbox') }
    finally { setLoading(false) }
  }, [view, channel, team, debounced])

  const loadDetail = useCallback(async (id: string, read = true) => {
    try {
      const d = await fetchDetail(id)
      if (selRef.current !== id) return
      setDetail(d)
      if (read) await markRead(id)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not load conversation') }
  }, [])

  useEffect(() => { setLoading(true); void loadList() }, [loadList])
  useEffect(() => {
    void fetchStaff().then((s) => setStaff(s ?? [])).catch(() => {})
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? ''))
  }, [])
  useEffect(() => {
    setDetail(null)
    if (selectedId) void loadDetail(selectedId).then(() => loadList())
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: any inbox change refreshes list + counts; changes to the open thread refresh it too.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listRef = useRef(loadList)
  listRef.current = loadList
  useEffect(() => {
    const bump = (convId?: string) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        void listRef.current()
        if (selRef.current && (!convId || convId === selRef.current)) void loadDetail(selRef.current)
      }, 350)
    }
    const ch = supabase.channel('inbox-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox_messages' },
        (p) => bump((p.new as { conversation_id?: string })?.conversation_id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox_conversations' },
        (p) => bump((p.new as { id?: string })?.id))
      .subscribe()
    const poll = setInterval(() => bump(), 60000)
    return () => { clearInterval(poll); void supabase.removeChannel(ch) }
  }, [loadDetail])

  const refresh = useCallback(() => {
    void loadList()
    if (selRef.current) void loadDetail(selRef.current)
  }, [loadList, loadDetail])

  return (
    <div className="ibx">
      <InboxNav counts={counts} view={view} channel={channel} team={team}
        onView={(v) => patch({ view: v === 'all' ? null : v })}
        onChannel={(c) => patch({ channel: c })}
        onTeam={(t) => patch({ team: t })} />
      <ConversationList rows={rows} loading={loading} error={error} view={view}
        selectedId={selectedId} search={search} onSearch={setSearch} onSelect={(id) => patch({ c: id })} />
      {detail ? (
        <ThreadView detail={detail} staff={staff} me={me} onChanged={refresh} />
      ) : (
        <main className="ibx-thread" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="ibx-empty">{selectedId ? 'Loading conversation…' : 'Pick a conversation'}</div>
        </main>
      )}
    </div>
  )
}
