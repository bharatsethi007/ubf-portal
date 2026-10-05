import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListChecks } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/supabase'
import { fetchStaffUsers } from '@/features/bookingRecord/bookingRecordApi'
import type { StaffUser } from '@/features/bookingRecord/bookingRecordTypes'
import { staffDisplayName, staffInitials } from '@/features/bookingRecord/staffDisplayUtils'
import TaskDrawer from './TaskDrawer'
import { ddmm, errText, fetchTasks, nzToday, updateTask, type Scope, type StaffTask } from './tasksApi'

const SCOPES: { key: Scope; label: string }[] = [{ key: 'mine', label: 'Mine' }, { key: 'unassigned', label: 'Unassigned' }, { key: 'all', label: 'All' }]

function plus(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}

function bucket(due: string | null, today: string): string {
  if (!due) return 'No date'
  if (due < today) return 'Overdue'
  if (due === today) return 'Today'
  if (due <= plus(today, 7)) return 'Next 7 days'
  return 'Later'
}
const ORDER = ['Overdue', 'Today', 'Next 7 days', 'Later', 'No date']

export default function MyTasksPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [scope, setScope] = useState<Scope>('mine')
  const [rows, setRows] = useState<StaffTask[]>([])
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const today = nzToday()

  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)) }, [])
  useEffect(() => { void fetchStaffUsers().then(setStaff).catch(() => setStaff([])) }, [])

  const load = useCallback(async () => {
    if (!userId) return
    try { setRows(await fetchTasks(scope, userId)) } catch (e) { toast.error(errText(e, 'Could not load tasks')) }
    finally { setLoading(false) }
  }, [scope, userId])
  useEffect(() => { setLoading(true); void load() }, [load])

  const groups = useMemo(() => {
    const m = new Map<string, StaffTask[]>()
    for (const r of rows) { const k = bucket(r.due_date, today); m.set(k, [...(m.get(k) ?? []), r]) }
    return ORDER.filter((k) => m.has(k)).map((k) => ({ key: k, items: m.get(k)! }))
  }, [rows, today])

  async function complete(t: StaffTask) {
    setRows((rs) => rs.filter((r) => r.id !== t.id))
    try { await updateTask(t.id, { status: 'done' }); toast.success('Done', { action: { label: 'Undo', onClick: () => void updateTask(t.id, { status: 'open' }).then(load) } }) }
    catch (e) { toast.error(errText(e, 'Could not complete')); void load() }
  }

  const who = (id: string | null) => staff.find((s) => s.user_id === id)

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card" style={{ background: '#fff' }}>
        <header className="quotes-page__head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ListChecks size={20} /> Tasks</h1>
          <div className="quotes-tabs">
            {SCOPES.map((s) => (
              <button key={s.key} type="button" className={`quotes-tabs__btn${scope === s.key ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setScope(s.key)}>{s.label}</button>
            ))}
          </div>
        </header>

        {loading ? <p className="text-muted-foreground" style={{ fontSize: 13 }}>Loading…</p>
          : rows.length === 0 ? <p className="text-muted-foreground" style={{ fontSize: 13, padding: '24px 0' }}>Nothing open. Nice.</p>
          : groups.map((g) => (
            <section key={g.key} style={{ marginTop: 16 }}>
              <h2 style={{ fontSize: 12, fontWeight: 600, color: g.key === 'Overdue' ? '#B42318' : '#475467', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 6px' }}>
                {g.key} <span style={{ color: '#98A2B3', fontWeight: 400 }}>{g.items.length}</span>
              </h2>
              <div style={{ border: '1px solid #EAECF0', borderRadius: 8, overflow: 'hidden' }}>
                {g.items.map((t) => {
                  const a = who(t.assigned_to)
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: '1px solid #F2F4F7', background: '#fff' }}>
                      <input type="checkbox" aria-label={`Complete ${t.title}`} onChange={() => void complete(t)} />
                      {t.priority === 'high' ? <span title="High priority" style={{ width: 6, height: 6, borderRadius: 3, background: '#D92D20' }} /> : null}
                      <button type="button" onClick={() => setOpenId(t.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontSize: 13, color: '#101828', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.title}
                        {t.subtasks ? <span style={{ marginLeft: 8, fontSize: 11, color: '#98A2B3' }}>{t.subtasks.done}/{t.subtasks.total}</span> : null}
                      </button>
                      <Link to={`/bookings/${t.booking_id}`} className="mono" style={{ fontSize: 12, color: '#2563EB', width: 120 }}>{t.booking?.booking_ref ?? ''}</Link>
                      <span style={{ fontSize: 12, color: '#667085', width: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.booking?.importer_name ?? ''}</span>
                      <span style={{ fontSize: 12, width: 44, color: t.due_date && t.due_date < today ? '#B42318' : '#475467' }}>{ddmm(t.due_date)}</span>
                      <span title={a ? staffDisplayName(a.email) : 'Unassigned'} style={{ width: 24, height: 24, borderRadius: 12, background: a ? '#EEF4FF' : '#F2F4F7', color: '#0A2472', fontSize: 10, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        {a ? staffInitials(a.email, a.initials) : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
      </div>
      <TaskDrawer taskId={openId} staff={staff} onClose={() => setOpenId(null)} onChanged={() => void load()} />
    </div>
  )
}
