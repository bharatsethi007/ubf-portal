import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Bell, Plus, Check, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { listReminders, addReminder, markReminderDone, deleteReminder, reminderFieldLabel, REMINDER_FIELDS, type VehicleReminder } from './remindersApi'

export default function VehicleReminders({ vehicleId }: { vehicleId: string }) {
  const [rows, setRows] = useState<VehicleReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [field, setField] = useState<string>('general')
  const [due, setDue] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => { setLoading(true); listReminders(vehicleId).then(setRows).catch(() => {}).finally(() => setLoading(false)) }
  useEffect(load, [vehicleId])

  async function add() {
    if (!due && !note.trim()) { toast.error('Add a due date or a note'); return }
    setSaving(true)
    try { await addReminder(vehicleId, field, due || null, note.trim() || null); setDue(''); setNote(''); setField('general'); load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSaving(false) }
  }
  async function done(id: string) { try { await markReminderDone(id); load() } catch { toast.error('Failed') } }
  async function del(id: string) { try { await deleteReminder(id); load() } catch { toast.error('Failed') } }

  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#0A2472]"><Bell size={14} />Reminders</div>
      {loading ? <p className="text-xs text-neutral-400">Loading…</p>
        : rows.length === 0 ? <p className="mb-2 text-xs text-neutral-400">No active reminders.</p>
        : (
          <div className="mb-2 space-y-1">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-md bg-neutral-50 px-2 py-1.5 text-xs">
                <span className="rounded bg-white px-1.5 py-0.5 font-medium text-neutral-600">{reminderFieldLabel(r.field)}</span>
                {r.due_date && <span className="text-neutral-500">{format(new Date(r.due_date), 'd MMM yyyy')}</span>}
                <span className="min-w-0 flex-1 truncate text-neutral-700">{r.note ?? ''}</span>
                <button type="button" title="Mark done" onClick={() => done(r.id)} className="shrink-0 rounded p-1 text-emerald-600 hover:bg-emerald-50"><Check size={13} /></button>
                <button type="button" title="Delete" onClick={() => del(r.id)} className="shrink-0 rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-neutral-500">Field</span>
          <select value={field} onChange={(e) => setField(e.target.value)} className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm outline-none focus:border-[#0A2472]">
            {REMINDER_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-neutral-500">Due</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm outline-none focus:border-[#0A2472]" />
        </label>
        <label className="block min-w-[140px] flex-1">
          <span className="mb-1 block text-[10px] font-medium text-neutral-500">Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Book WOF" className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm outline-none focus:border-[#0A2472]" />
        </label>
        <button type="button" onClick={add} disabled={saving} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-[#0A2472] hover:bg-neutral-50"><Plus size={14} />Add</button>
      </div>
    </div>
  )
}
