import { Fragment, useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  listCartageSurcharges,
  updateCartageSurcharge,
  addSurchargeTier,
  updateSurchargeTier,
  deleteSurchargeTier,
  type CartageSurcharge,
} from './cartageApi'

const addRow = { display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' as const, marginBottom: 10 }

type Props = { onCount?: (n: number) => void }

export default function CartageSurchargesTab({ onCount }: Props) {
  const [rows, setRows] = useState<CartageSurcharge[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [tier, setTier] = useState({ threshold_kg: '', amount: '' })

  const reload = useCallback(() => {
    listCartageSurcharges()
      .then((r) => {
        setRows(r)
        onCount?.(r.length)
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load surcharges'))
  }, [onCount])

  useEffect(() => {
    reload()
  }, [reload])

  function toggleOpen(s: CartageSurcharge) {
    if (open === s.id) {
      setOpen(null)
      return
    }
    setOpen(s.id)
    setTier({ threshold_kg: '', amount: '' })
  }

  async function saveAmount(s: CartageSurcharge, v: string) {
    try {
      await updateCartageSurcharge(s.id, { default_amount: v === '' ? null : Number(v) })
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function toggle(s: CartageSurcharge) {
    try {
      await updateCartageSurcharge(s.id, { active: !s.active })
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  async function addTier(s: CartageSurcharge) {
    if (!tier.threshold_kg) return
    try {
      await addSurchargeTier({
        surcharge_id: s.id,
        threshold_kg: Number(tier.threshold_kg),
        amount: Number(tier.amount) || 0,
      })
      setTier({ threshold_kg: '', amount: '' })
      reload()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Add failed'
      toast.error(msg.includes('duplicate') ? 'Threshold already exists' : msg)
    }
  }

  async function saveTierField(tierId: string, patch: { threshold_kg?: number; amount?: number }) {
    try {
      await updateSurchargeTier(tierId, patch)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function removeTier(tierId: string) {
    try {
      await deleteSurchargeTier(tierId)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Label</th>
            <th>Applies</th>
            <th>Calc</th>
            <th>Default amount</th>
            <th>Active</th>
            <th aria-label="Tiers" style={{ width: 90 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <Fragment key={s.id}>
              <tr>
                <td>{s.code}</td>
                <td>{s.label}</td>
                <td>{s.applies_to}</td>
                <td>{s.calc}</td>
                <td>
                  {s.calc === 'tiered_weight' ? (
                    <span className="text-muted-foreground">see tiers</span>
                  ) : (
                    <input
                      className="input input--sm"
                      type="number"
                      defaultValue={s.default_amount ?? ''}
                      onBlur={(e) => saveAmount(s, e.target.value)}
                      style={{ width: 110 }}
                    />
                  )}
                </td>
                <td>
                  <input type="checkbox" checked={s.active} onChange={() => toggle(s)} />
                </td>
                <td>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {s.calc === 'tiered_weight' && (
                      <button type="button" className="text-link" onClick={() => toggleOpen(s)}>
                        {open === s.id ? 'Hide' : 'Tiers'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              {open === s.id && (
                <tr>
                  <td colSpan={7}>
                    <div style={addRow}>
                      <button type="button" className="btn btn--inline" title="Add tier" aria-label="Add tier" style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => addTier(s)}><Plus size={16} strokeWidth={2} /></button>
                      <input
                        className="input input--sm"
                        style={{ width: 200 }}
                        type="number"
                        placeholder="threshold kg (e.g. 20000)"
                        value={tier.threshold_kg}
                        onChange={(e) => setTier({ ...tier, threshold_kg: e.target.value })}
                      />
                      <input
                        className="input input--sm"
                        style={{ width: 130 }}
                        type="number"
                        placeholder="amount"
                        value={tier.amount}
                        onChange={(e) => setTier({ ...tier, amount: e.target.value })}
                      />
                    </div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Threshold kg</th>
                          <th>Amount</th>
                          <th aria-label="Actions" style={{ width: 60 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {[...(s.cartage_surcharge_tiers ?? [])]
                          .sort((a, b) => a.threshold_kg - b.threshold_kg)
                          .map((t) => (
                            <tr key={t.id}>
                              <td>
                                <input
                                  className="input input--sm"
                                  type="number"
                                  defaultValue={t.threshold_kg}
                                  onBlur={(e) => saveTierField(t.id, { threshold_kg: Number(e.target.value) })}
                                  style={{ width: 120 }}
                                />
                              </td>
                              <td>
                                <input
                                  className="input input--sm"
                                  type="number"
                                  defaultValue={t.amount}
                                  onBlur={(e) => saveTierField(t.id, { amount: Number(e.target.value) })}
                                  style={{ width: 110 }}
                                />
                              </td>
                              <td>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <button type="button" className="icon-btn" aria-label="Delete tier" onClick={() => removeTier(t.id)}>
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
