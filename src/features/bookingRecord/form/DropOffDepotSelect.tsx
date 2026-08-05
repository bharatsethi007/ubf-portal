import { useEffect, useState } from 'react'
import { Pencil, Plus, Settings2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  createDropOffDepot, deleteDropOffDepot, listDropOffDepots, updateDropOffDepot,
  type DropOffDepot,
} from './dropOffDepotApi'

type Props = { value: string | null; onChange: (code: string | null) => void }

export default function DropOffDepotSelect({ value, onChange }: Props) {
  const [depots, setDepots] = useState<DropOffDepot[]>([])
  const [manageOpen, setManageOpen] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editName, setEditName] = useState('')

  async function reload() {
    try { setDepots(await listDropOffDepots()) } catch (e) { toast.error(e instanceof Error ? e.message : 'Load failed') }
  }
  useEffect(() => { void reload() }, [])

  async function add() {
    if (!newCode.trim() || !newName.trim()) return
    try { await createDropOffDepot(newCode, newName); setNewCode(''); setNewName(''); await reload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Add failed') }
  }
  async function saveEdit() {
    if (!editId) return
    try { await updateDropOffDepot(editId, { code: editCode.trim(), name: editName.trim() }); setEditId(null); await reload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
  }
  async function remove(id: string) {
    try { await deleteDropOffDepot(id); await reload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
  }

  return (
    <label className="filter-field booking-form-field">
      <span className="filter-field__label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Drop-off depot
        <button type="button" className="text-link" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }} onClick={() => setManageOpen(true)}>
          <Settings2 size={12} /> Manage
        </button>
      </span>
      <select className="input input--sm" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Select depot…</option>
        {depots.filter((d) => d.active || d.code === value).map((d) => (
          <option key={d.id} value={d.code}>{d.code} — {d.name}</option>
        ))}
      </select>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Drop-off depots</DialogTitle></DialogHeader>
          <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {depots.map((d) => (
              <div key={d.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {editId === d.id ? (
                  <>
                    <input className="input input--xs" style={{ width: 90 }} value={editCode} onChange={(e) => setEditCode(e.target.value)} />
                    <input className="input input--xs" style={{ flex: 1 }} value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <button type="button" className="btn" onClick={() => void saveEdit()}>Save</button>
                    <button type="button" className="text-link" onClick={() => setEditId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="mono" style={{ width: 90, fontSize: 12 }}>{d.code}</span>
                    <span style={{ flex: 1, fontSize: 12 }}>{d.name}</span>
                    <button type="button" className="master-bill-field__copy" title="Edit" onClick={() => { setEditId(d.id); setEditCode(d.code); setEditName(d.name) }}><Pencil size={13} /></button>
                    <button type="button" className="master-bill-field__copy" title="Remove" style={{ color: '#b42318' }} onClick={() => void remove(d.id)}><Trash2 size={13} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 4 }}>
            <input className="input input--xs" style={{ width: 90 }} placeholder="Code" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
            <input className="input input--xs" style={{ flex: 1 }} placeholder="Depot name & address" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button type="button" className="btn" onClick={() => void add()}><Plus size={13} /> Add</button>
          </div>
        </DialogContent>
      </Dialog>
    </label>
  )
}
