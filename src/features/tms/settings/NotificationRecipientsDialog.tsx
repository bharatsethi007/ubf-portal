import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Bell, Plus, Trash2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { listRecipients, addRecipient, removeRecipient, setRecipientActive, type Recipient } from './notificationsApi'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function NotificationRecipientsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<Recipient[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => { setLoading(true); listRecipients().then(setRows).catch(() => {}).finally(() => setLoading(false)) }
  useEffect(() => { if (open) load() }, [open])

  async function add() {
    const e = email.trim().toLowerCase()
    if (!EMAIL_RE.test(e)) { toast.error('Enter a valid email'); return }
    setSaving(true)
    try { await addRecipient(e); setEmail(''); load() }
    catch (err) { const m = err instanceof Error ? err.message : 'Failed'; toast.error(/duplicate|unique/i.test(m) ? 'Already added' : m) }
    finally { setSaving(false) }
  }
  async function remove(id: string) { try { await removeRecipient(id); load() } catch { toast.error('Failed') } }
  async function toggle(id: string, active: boolean) { try { await setRecipientActive(id, active); load() } catch { toast.error('Failed') } }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Bell size={16} className="text-[#0A2472]" />Reminder emails</DialogTitle></DialogHeader>
        <p className="text-xs text-neutral-500">These addresses receive the 7:30am fleet reminder digest.</p>
        <div className="flex items-end gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} type="email" placeholder="name@ubfreight.com"
            className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-[#0A2472]" />
          <button type="button" onClick={add} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-[#0A2472] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0A2472]/90"><Plus size={14} />Add</button>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {loading ? <p className="py-3 text-center text-xs text-neutral-400">Loading…</p>
            : rows.length === 0 ? <p className="py-3 text-center text-xs text-neutral-400">No recipients yet.</p>
            : rows.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg border border-neutral-100 px-2.5 py-1.5">
                <Mail size={13} className="shrink-0 text-neutral-400" />
                <span className={`min-w-0 flex-1 truncate text-sm ${r.active ? 'text-neutral-800' : 'text-neutral-400 line-through'}`}>{r.email}</span>
                <label className="flex shrink-0 items-center gap-1 text-[11px] text-neutral-500">
                  <input type="checkbox" checked={r.active} onChange={(e) => toggle(r.id, e.target.checked)} className="h-3.5 w-3.5" />Active
                </label>
                <button type="button" title="Remove" onClick={() => remove(r.id)} className="shrink-0 rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
