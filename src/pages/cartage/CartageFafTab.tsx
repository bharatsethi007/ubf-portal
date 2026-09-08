import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import DateField from '@/components/DateField'
import { Button } from '@/components/ui/button'
import { listCartageFaf, upsertCartageFaf, deleteCartageFaf, type CartageFaf } from './cartageApi'

const firstOfMonth = (iso: string) => (iso ? `${iso.slice(0, 8)}01` : '')

const labelStyle = { fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }

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
      <div className="quotes-page__toolbar" style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <div>
          <label style={labelStyle}>Month</label>
          <DateField
            value={draft.effective_month || null}
            onChange={(v) => setDraft({ ...draft, effective_month: v })}
            width={150}
          />
        </div>
        <input
          className="input input--sm"
          type="number"
          placeholder="percent"
          value={draft.percent}
          onChange={(e) => setDraft({ ...draft, percent: e.target.value })}
        />
        <input
          className="input input--sm"
          placeholder="note"
          value={draft.note}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
        />
        <Button type="button" onClick={save}>Save month</Button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Percent</th>
              <th>Note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <td>{f.effective_month.slice(0, 7)}</td>
                <td>{f.percent}%</td>
                <td>{f.note ?? '-'}</td>
                <td>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Delete FAF row" onClick={() => remove(f.id)}>
                    <Trash2 size={16} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground pad-inline">
        Re-saving an existing month overwrites its %. FAF applies to base LTL freight only.
      </p>
    </div>
  )
}
