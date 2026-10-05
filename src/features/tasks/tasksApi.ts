import { supabase } from '@/supabase'

export type Priority = 'low' | 'normal' | 'high'
export type TaskStatus = 'open' | 'done' | 'na' | 'cancelled'

export type StaffTask = {
  id: string
  booking_id: string
  parent_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  assigned_to: string | null
  due_date: string | null
  priority: Priority
  is_default: boolean
  billable: boolean
  created_by: string | null
  created_at: string
  completed_at: string | null
  booking: { booking_ref: string | null; importer_name: string | null } | null
  subtasks?: { total: number; done: number }
}

export type TaskComment = {
  id: string
  task_id: string
  author_id: string
  author_kind: 'staff' | 'customer'
  body: string
  created_at: string
}

export type Scope = 'mine' | 'unassigned' | 'all'

const COLS = `id, booking_id, parent_id, title, description, status, assigned_to, due_date, priority, is_default, billable,
  created_by, created_at, completed_at, booking:bookings!inner ( booking_ref, importer_name, archived_at )`

type Row = Omit<StaffTask, 'booking'> & { booking: { booking_ref: string | null; importer_name: string | null } | null }

/** Open staff tasks across live bookings. Default checklist items only show once someone owns them. */
export async function fetchTasks(scope: Scope, userId: string): Promise<StaffTask[]> {
  let q = supabase.from('booking_tasks').select(COLS)
    .eq('audience', 'staff').eq('status', 'open').is('parent_id', null).is('booking.archived_at', null)
  if (scope === 'mine') q = q.eq('assigned_to', userId)
  if (scope === 'unassigned') q = q.is('assigned_to', null).eq('is_default', false)
  if (scope === 'all') q = q.or('is_default.eq.false,assigned_to.not.is.null')
  const { data, error } = await q.order('due_date', { ascending: true, nullsFirst: false }).limit(500)
  if (error) throw error
  const rows = (data ?? []) as unknown as Row[]
  return withSubtaskCounts(rows)
}

async function withSubtaskCounts(rows: StaffTask[]): Promise<StaffTask[]> {
  const ids = rows.map((r) => r.id)
  if (!ids.length) return rows
  const { data } = await supabase.from('booking_tasks').select('parent_id, status').in('parent_id', ids)
  const counts = new Map<string, { total: number; done: number }>()
  for (const c of (data ?? []) as { parent_id: string; status: string }[]) {
    const cur = counts.get(c.parent_id) ?? { total: 0, done: 0 }
    cur.total += 1
    if (c.status === 'done') cur.done += 1
    counts.set(c.parent_id, cur)
  }
  return rows.map((r) => ({ ...r, subtasks: counts.get(r.id) }))
}

export async function fetchTask(id: string): Promise<StaffTask | null> {
  const { data, error } = await supabase.from('booking_tasks')
    .select(COLS.replace('bookings!inner', 'bookings')).eq('id', id).maybeSingle()
  if (error) throw error
  return (data as unknown as StaffTask) ?? null
}

export async function fetchSubtasks(parentId: string): Promise<StaffTask[]> {
  const { data, error } = await supabase.from('booking_tasks')
    .select(COLS.replace('bookings!inner', 'bookings')).eq('parent_id', parentId).order('created_at')
  if (error) throw error
  return (data ?? []) as unknown as StaffTask[]
}

export type TaskPatch = Partial<Pick<StaffTask, 'title' | 'description' | 'status' | 'assigned_to' | 'due_date' | 'priority'>>

export async function updateTask(id: string, patch: TaskPatch): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  const extra = patch.status === 'done' ? { completed_by: auth.user?.id ?? null } : patch.status === 'open' ? { completed_by: null } : {}
  const { error } = await supabase.from('booking_tasks').update({ ...patch, ...extra }).eq('id', id)
  if (error) throw error
}

export async function addSubtask(parent: StaffTask, title: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase.from('booking_tasks').insert({
    booking_id: parent.booking_id, parent_id: parent.id, title, audience: 'staff', status: 'open',
    is_default: false, sort_order: 999, created_by: auth.user?.id ?? null, assigned_to: parent.assigned_to,
  })
  if (error) throw error
}

export async function fetchComments(taskId: string): Promise<TaskComment[]> {
  const { data, error } = await supabase.from('booking_task_comments')
    .select('id, task_id, author_id, author_kind, body, created_at').eq('task_id', taskId).order('created_at')
  if (error) throw error
  return (data ?? []) as TaskComment[]
}

export async function addComment(taskId: string, body: string): Promise<void> {
  const { error } = await supabase.from('booking_task_comments').insert({ task_id: taskId, body, author_kind: 'staff' })
  if (error) throw error
}

export function errText(e: unknown, fallback: string): string {
  return typeof e === 'object' && e && 'message' in e && typeof (e as { message: unknown }).message === 'string'
    ? (e as { message: string }).message : fallback
}

export function nzToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })
}

export function ddmm(iso: string | null): string {
  if (!iso) return ''
  const [, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}`
}
