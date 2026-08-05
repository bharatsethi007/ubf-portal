import { useEffect, useState } from 'react'
import { FileText, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  createCartageTemplate, deleteCartageTemplate, listCartageTemplates, updateCartageTemplate,
  type CartageTemplate,
} from './cartageTemplateApi'

type Slice = 'full' | 'empty'
type Props = {
  full: string | null
  empty: string | null
  onChange: (slice: Slice, value: string) => void
}

export default function CartageInstructions({ full, empty, onChange }: Props) {
  const [slice, setSlice] = useState<Slice>('full')
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<CartageTemplate[]>([])
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [editId, setEditId] = useState<string | null>(null)

  const current = slice === 'full' ? (full ?? '') : (empty ?? '')

  async function reload() {
    try { setTemplates(await listCartageTemplates()) } catch (e) { toast.error(e instanceof Error ? e.message : 'Load failed') }
  }
  useEffect(() => { if (open) void reload() }, [open])

  function resetForm() { setEditId(null); setName(''); setBody('') }
  async function save() {
    if (!name.trim()) { toast.error('Template needs a name'); return }
    try {
      if (editId) await updateCartageTemplate(editId, { name, body })
      else await createCartageTemplate(name, body)
      resetForm(); await reload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
  }
  async function remove(id: string) {
    try { await deleteCartageTemplate(id); if (editId === id) resetForm(); await reload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
  }
  function use(t: CartageTemplate) {
    onChange(slice, current ? `${current}\n${t.body}` : t.body)
    setOpen(false)
    toast.success(`Applied “${t.name}” to ${slice}`)
  }

  return (
    <div className="filter-field booking-form-field">
      <div className="cartage-instr__head">
        <span className="filter-field__label">Cartage instructions</span>
        <button type="button" className="text-link cartage-instr__tpl-btn" onClick={() => setOpen(true)}>
          <FileText size={12} /> Templates
        </button>
      </div>

      <div className="cartage-instr__tabs">
        <button type="button" className={`cartage-instr__tab${slice === 'full' ? ' on' : ''}`} onClick={() => setSlice('full')}>Full</button>
        <button type="button" className={`cartage-instr__tab${slice === 'empty' ? ' on' : ''}`} onClick={() => setSlice('empty')}>Empty</button>
      </div>

      <Textarea
        className="booking-compact-textarea"
        placeholder={`Cartage instructions for the ${slice} leg…`}
        value={current}
        onChange={(e) => onChange(slice, e.target.value)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent style={{ width: 'min(860px, 92vw)', maxWidth: 'min(860px, 92vw)' }}>
          <DialogHeader><DialogTitle>Cartage instruction templates</DialogTitle></DialogHeader>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {templates.length === 0 ? <p className="muted" style={{ fontSize: 12 }}>No templates yet.</p> : null}
              {templates.map((t) => (
                <div key={t.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{t.name}</span>
                    <button type="button" className="btn" style={{ width: 'auto', flex: '0 0 auto', padding: '4px 14px', fontSize: 12 }} onClick={() => use(t)}>Use</button>
                    <button type="button" className="master-bill-field__copy" title="Edit" onClick={() => { setEditId(t.id); setName(t.name); setBody(t.body) }}><Pencil size={13} /></button>
                    <button type="button" className="master-bill-field__copy" title="Delete" style={{ color: '#b42318' }} onClick={() => void remove(t.id)}><Trash2 size={13} /></button>
                  </div>
                  {t.body ? <p className="muted" style={{ fontSize: 11, whiteSpace: 'pre-wrap', marginTop: 6 }}>{t.body}</p> : null}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{editId ? 'Edit template' : 'New template'}</span>
                {editId ? <button type="button" className="text-link" onClick={resetForm}>New</button> : null}
                <button type="button" className="text-link" onClick={() => setBody(current)}>Load current {slice}</button>
              </div>
              <input className="input input--sm" placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea className="booking-compact-textarea" style={{ minHeight: 200 }} placeholder="Template body…" value={body} onChange={(e) => setBody(e.target.value)} />
              <button type="button" className="btn" style={{ width: 'auto', alignSelf: 'flex-start', padding: '6px 16px' }} onClick={() => void save()}>
                {editId ? 'Save changes' : 'Add template'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
