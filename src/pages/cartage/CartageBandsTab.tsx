import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
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
      <div className="quotes-page__toolbar">
        <button
          type="button"
          style={{ width: 'auto' }}
          className="quotes-page__new-btn"
          onClick={() => setEditing({ ...empty, sort_order: bands.length + 1 })}
        >
          + New band
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
              <th />
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
                  <button type="button" style={{ width: 'auto' }} onClick={() => setEditing(b)}>
                    Edit
                  </button>{' '}
                  <button type="button" style={{ width: 'auto' }} onClick={() => remove(b)}>
                    Del
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div
          role="presentation"
          onClick={() => setEditing(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(14,27,45,.35)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 60,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(480px, calc(100% - 32px))',
              padding: 24,
              background: '#fff',
              borderRadius: 12,
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>
              {editing.id ? 'Edit' : 'New'} band
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
              }}
            >
              <div style={fieldStyle}>
                <label style={labelStyle}>Code</label>
                <input
                  className="input"
                  value={editing.band_code ?? ''}
                  onChange={(e) => setEditing({ ...editing, band_code: e.target.value })}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Label</label>
                <input
                  className="input"
                  value={editing.label ?? ''}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Min kg</label>
                <input
                  className="input"
                  type="number"
                  value={editing.min_kg ?? 0}
                  onChange={(e) => setEditing({ ...editing, min_kg: Number(e.target.value) })}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Max kg (blank = top)</label>
                <input
                  className="input"
                  type="number"
                  value={editing.max_kg ?? ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      max_kg: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Sort order</label>
                <input
                  className="input"
                  type="number"
                  value={editing.sort_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" style={{ width: 'auto' }} onClick={save}>
                Save
              </button>
              <button type="button" style={{ width: 'auto' }} onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
