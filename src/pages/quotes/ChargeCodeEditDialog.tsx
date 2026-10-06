import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../supabase'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'

export type EditableCode = { code: string; description: string; charge_group: string; default_unit: string | null }
type Opt = { value: string; label: string }

type Props = {
  code: EditableCode | null
  groups: Opt[]
  units: Opt[]
  onClose: () => void
  /** Called after save with the old and new description so the grid can follow the rename. */
  onSaved: (oldDesc: string, next: EditableCode) => void
}

// Edits a charge code in the master list straight from the quote grid.
// Code is the key (used by templates / ERP), so it stays read-only here.
export default function ChargeCodeEditDialog({ code, groups, units, onClose, onSaved }: Props) {
  const [desc, setDesc] = useState('')
  const [group, setGroup] = useState('freight')
  const [unit, setUnit] = useState('')
  const [active, setActive] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!code) return
    setDesc(code.description)
    setGroup(code.charge_group)
    setUnit(code.default_unit ?? '')
    setActive(true)
  }, [code])

  async function save() {
    if (!code) return
    const d = desc.trim()
    if (!d) { toast.error('Description required'); return }
    setBusy(true)
    const { error } = await supabase
      .from('charge_codes')
      .update({ description: d, charge_group: group, default_unit: unit || null, active })
      .eq('code', code.code)
    setBusy(false)
    if (error) { toast.error(`Could not save: ${error.message}`); return }
    toast.success(active ? `${code.code} updated` : `${code.code} deactivated`)
    onSaved(code.description, { code: code.code, description: d, charge_group: group, default_unit: unit || null })
  }

  const field = 'flex flex-col gap-1 text-xs text-slate-500'
  const input = 'qrl-in w-full'

  return (
    <Dialog open={code != null} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="z-[120] gap-4 rounded-xl bg-white p-5 sm:max-w-md" overlayClassName="z-[110] bg-black/30">
        <DialogHeader>
          <DialogTitle>Edit charge code</DialogTitle>
        </DialogHeader>
        <label className={field}>Code
          <input className={`${input} bg-slate-50`} value={code?.code ?? ''} readOnly />
        </label>
        <label className={field}>Description
          <input className={input} value={desc} autoFocus onChange={(e) => setDesc(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={field}>Group
            <select className={input} value={group} onChange={(e) => setGroup(e.target.value)}>
              {groups.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </label>
          <label className={field}>Default unit
            <select className={input} value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="">None</option>
              {units.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (untick to hide from the charge list)
        </label>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy}
            className="h-9 rounded-md border border-slate-300 bg-transparent px-4 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={busy}
            className="h-9 rounded-md bg-[#3B5BFE] px-4 text-sm text-white hover:bg-[#2f4de0] disabled:opacity-50">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
