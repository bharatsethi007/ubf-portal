import { supabase } from '@/supabase'

export const REMINDER_FIELDS = [
  { key: 'rego_expiry', label: 'Rego expiry' },
  { key: 'cof_expiry', label: 'COF expiry' },
  { key: 'last_service', label: 'Last service' },
  { key: 'next_service', label: 'Next service' },
  { key: 'general', label: 'General' },
] as const
export type ReminderField = typeof REMINDER_FIELDS[number]['key']
export const reminderFieldLabel = (f: string) => REMINDER_FIELDS.find((x) => x.key === f)?.label ?? f

export type VehicleReminder = { id: string; vehicle_id: string; field: string; due_date: string | null; note: string | null; done: boolean }
export type DueReminder = { id: string; field: string; due_date: string | null; note: string | null; registration_number: string }

const today = () => new Date().toISOString().slice(0, 10)
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) }

export async function listReminders(vehicleId: string): Promise<VehicleReminder[]> {
  const { data, error } = await supabase.from('tms_vehicle_reminders')
    .select('id,vehicle_id,field,due_date,note,done')
    .eq('vehicle_id', vehicleId).eq('done', false)
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as VehicleReminder[]
}

export async function addReminder(vehicleId: string, field: string, dueDate: string | null, note: string | null): Promise<void> {
  const { error } = await supabase.from('tms_vehicle_reminders').insert({ vehicle_id: vehicleId, field, due_date: dueDate, note })
  if (error) throw error
}

export async function markReminderDone(id: string): Promise<void> {
  const { error } = await supabase.from('tms_vehicle_reminders').update({ done: true }).eq('id', id)
  if (error) throw error
}

export async function deleteReminder(id: string): Promise<void> {
  const { error } = await supabase.from('tms_vehicle_reminders').delete().eq('id', id)
  if (error) throw error
}

export async function listDueReminders(): Promise<DueReminder[]> {
  const t = today()
  const { data, error } = await supabase.from('tms_vehicle_reminders')
    .select('id,field,due_date,note,vehicle:tms_vehicles!tms_vehicle_reminders_vehicle_id_fkey(registration_number)')
    .eq('done', false)
    .or(`due_date.is.null,due_date.lte.${t}`)
    .or(`snoozed_until.is.null,snoozed_until.lte.${t}`)
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id, field: r.field, due_date: r.due_date ?? null, note: r.note ?? null,
    registration_number: r.vehicle?.registration_number ?? '—',
  }))
}

export async function snoozeReminders(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await supabase.from('tms_vehicle_reminders').update({ snoozed_until: tomorrow() }).in('id', ids)
  if (error) throw error
}
