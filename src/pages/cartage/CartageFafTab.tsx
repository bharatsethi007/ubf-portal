import { useCallback, useEffect, useState } from 'react'
import { Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import DateField from '@/components/DateField'
import { listCartageFaf, upsertCartageFaf, deleteCartageFaf, type CartageFaf } from './cartageApi'

const firstOfMonth = (iso: string) => (iso ? `${iso.slice(0, 8)}01` : '')

const labelStyle = { fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }
const addRow = { display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' as const, marginBottom: 14 }

type Props = { onCount?: (n: number) => void }

export default function CartageFafTab({ onCount }: Props) {
  const [rows, setRows] = useState<CartageFaf[]>([])
  const [draft, setDraft] = useState({ effective_month: '', percent: '', note: '' })

  const reload = useCallback(() => {
    listCartageFaf()
      .then((r) => {
        setRows(r)
        onCount?.(r.length)
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load FAF'))
  }, [onCount])

  useEffect(() => {
    reload()
  }, [reload])

  async function save() {
    const m = firstOfMonth(draft.effective_month)
    if (!m || draft.percent === '') {
      toast.error('Month and percent required')
      return
    }
    try {
      await upsertCartageFaf({
        effective_month: m,
        percent: Number(draft.percent),
        note: draft.note || null,
      })
      setDraft({ effective_month: '', percent: '', note: '' })
      reload()
      toast.success('Saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function remove(id: string) {
    try {
      await deleteCartageFaf(id)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div>
      <div style={addRow}>
        <div>
          <label style={labelStyle}>Month</label>
          <DateField
            value={draft.effective_month || null}
            onChange={(v) => setDraft({ ...draft, effective_month: v })}
            width={150}
          />
        </div>
        <div>
          <label style={labelStyle}>Percent</label>
          <input
            className="input input--sm"
            style={{ width: 110 }}
            type="number"
            placeholder="e.g. 12.5"
            value={draft.percent}
            onChange={(e) => setDraft({ ...draft, percent: e.target.value })}
          />
        </div>
        <div>
          <label style={labelStyle}>Note</label>
          <input
            className="input input--sm"
            style={{ width: 220 }}
            placeholder="optional"
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </div>
        <button type="button" className="btn btn--inline" title="Save month" aria-label="Save month" style={{ marginTop: 0, marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={save}><Save size={16} strokeWidth={2} /></button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Percent</th>
              <th>Note</th>
              <th aria-label="Actions" style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted-foreground pad-inline">No FAF set yet.</td>
              </tr>
            ) : (
              rows.map((f) => (
                <tr key={f.id}>
                  <td>{f.effective_month.slice(0, 7)}</td>
                  <td>{f.percent}%</td>
                  <td>{f.note ?? '-'}</td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="button" className="icon-btn" aria-label="Delete FAF row" onClick={() => remove(f.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground pad-inline" style={{ marginTop: 10 }}>
        Re-saving an existing month overwrites its %. FAF applies to base LTL freight only.
      </p>
    </div>
  )
}
