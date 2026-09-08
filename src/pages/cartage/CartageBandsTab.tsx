import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  listCartageBands,
  createCartageBand,
  updateCartageBand,
  deleteCartageBand,
  type CartageBand,
} from './cartageApi'

const empty: Partial<CartageBand> = {
  band_code: '',
  label: '',
  min_kg: 0,
  max_kg: null,
  sort_order: 0,
  active: true,
}

const fieldStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6 }
const labelStyle = { fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }

type Props = { onCount?: (n: number) => void }

export default function CartageBandsTab({ onCount }: Props) {
  const [bands, setBands] = useState<CartageBand[]>([])
  const [editing, setEditing] = useState<Partial<CartageBand> | null>(null)

  const reload = useCallback(() => {
    listCartageBands()
      .then((b) => {
        setBands(b)
        onCount?.(b.length)
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load bands'))
  }, [onCount])

  useEffect(() => {
    reload()
  }, [reload])

  async function save() {
    if (!editing?.band_code || !editing?.label) {
      toast.error('Code and label required')
      return
    }
    const maxRaw = editing.max_kg
    const body = {
      ...editing,
      min_kg: Number(editing.min_kg),
      max_kg:
        maxRaw === null || maxRaw === undefined || (maxRaw as unknown) === ''
          ? null
          : Number(maxRaw),
      sort_order: Number(editing.sort_order) || 0,
    }
    try {
      if (editing.id) await updateCartageBand(editing.id, body)
      else await createCartageBand(body)
      setEditing(null)
      reload()
      toast.success('Saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function remove(b: CartageBand) {
    if (!confirm(`Delete band ${b.band_code}?`)) return
    try {
      await deleteCartageBand(b.id)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div>
      <div className="quotes-page__toolbar" style={{ justifyContent: 'flex-start', margin: '16px 0' }}>
        <button type="button" className="btn quotes-page__new-btn" title="New band" aria-label="New band" onClick={() => setEditing({ ...empty, sort_order: bands.length + 1 })}>
          <Plus size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Label</th>
              <th>Min kg</th>
              <th>Max kg</th>
              <th>Order</th>
              <th aria-label="Actions" style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {bands.map((b) => (
              <tr key={b.id}>
                <td>{b.band_code}</td>
                <td>{b.label}</td>
                <td>{b.min_kg}</td>
                <td>{b.max_kg ?? '+'}</td>
                <td>{b.sort_order}</td>
                <td>
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <button type="button" className="icon-btn" aria-label="Edit band" onClick={() => setEditing(b)}>
                      <Pencil size={16} />
                    </button>
                    <button type="button" className="icon-btn" aria-label="Delete band" onClick={() => remove(b)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit' : 'New'} band</DialogTitle>
          </DialogHeader>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Code</label>
              <input className="input" value={editing?.band_code ?? ''} onChange={(e) => setEditing({ ...editing!, band_code: e.target.value })} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Label</label>
              <input className="input" value={editing?.label ?? ''} onChange={(e) => setEditing({ ...editing!, label: e.target.value })} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Min kg</label>
              <input className="input" type="number" value={editing?.min_kg ?? 0} onChange={(e) => setEditing({ ...editing!, min_kg: Number(e.target.value) })} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Max kg (blank = top)</label>
              <input
                className="input"
                type="number"
                value={editing?.max_kg ?? ''}
                onChange={(e) => setEditing({ ...editing!, max_kg: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Sort order</label>
              <input className="input" type="number" value={editing?.sort_order ?? 0} onChange={(e) => setEditing({ ...editing!, sort_order: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <button type="button" className="text-link" onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="btn btn--inline" title="Save" aria-label="Save" style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={save}><Save size={16} strokeWidth={2} /></button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
