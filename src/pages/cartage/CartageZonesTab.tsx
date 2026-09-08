import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  listCartageZones,
  createCartageZone,
  updateCartageZone,
  deleteCartageZone,
  listZoneMembers,
  addZoneMember,
  deleteZoneMember,
  type CartageZone,
  type ZoneMember,
} from './cartageApi'

const empty: Partial<CartageZone> = {
  zone_code: '',
  name: '',
  zone_type: 'area',
  island: null,
  region: '',
}

const MATCH_TYPES = ['postcode', 'postcode_range', 'suburb', 'city'] as const
const fieldStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6 }
const labelStyle = { fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }
const addRow = { display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' as const, margin: '14px 0' }

type Props = { onCount?: (n: number) => void }

export default function CartageZonesTab({ onCount }: Props) {
  const [zones, setZones] = useState<CartageZone[]>([])
  const [editing, setEditing] = useState<Partial<CartageZone> | null>(null)
  const [selected, setSelected] = useState<CartageZone | null>(null)
  const [members, setMembers] = useState<ZoneMember[]>([])
  const [mDraft, setMDraft] = useState<{
    match_type: ZoneMember['match_type']
    value: string
    value_to: string
  }>({ match_type: 'postcode', value: '', value_to: '' })

  const reload = useCallback(() => {
    listCartageZones()
      .then((z) => {
        setZones(z)
        onCount?.(z.length)
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load zones'))
  }, [onCount])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!selected) {
      setMembers([])
      return
    }
    listZoneMembers(selected.id)
      .then(setMembers)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load members'))
  }, [selected])

  async function saveZone() {
    if (!editing?.zone_code || !editing?.name) {
      toast.error('Code and name required')
      return
    }
    try {
      if (editing.id) await updateCartageZone(editing.id, editing)
      else await createCartageZone({ ...editing, region: editing.region || null })
      setEditing(null)
      reload()
      toast.success('Saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function removeZone(z: CartageZone) {
    if (!confirm(`Delete zone ${z.zone_code}? Removes its members too.`)) return
    try {
      await deleteCartageZone(z.id)
      if (selected?.id === z.id) setSelected(null)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  async function addMember() {
    if (!selected || !mDraft.value) return
    try {
      await addZoneMember({
        zone_id: selected.id,
        match_type: mDraft.match_type,
        value: mDraft.value.trim(),
        value_to: mDraft.match_type === 'postcode_range' ? mDraft.value_to.trim() || null : null,
      })
      setMDraft({ match_type: mDraft.match_type, value: '', value_to: '' })
      listZoneMembers(selected.id).then(setMembers)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Add failed'
      toast.error(msg.includes('duplicate') ? `"${mDraft.value}" already maps to a zone` : msg)
    }
  }

  async function removeMember(id: string) {
    try {
      await deleteZoneMember(id)
      setMembers((ms) => ms.filter((m) => m.id !== id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div>
      <div className="quotes-page__toolbar">
        <button type="button" className="btn quotes-page__new-btn" onClick={() => setEditing({ ...empty })}>
          <Plus size={16} strokeWidth={2} />
          New zone
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Island</th>
              <th>Region</th>
              <th aria-label="Actions" style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {zones.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted-foreground pad-inline">No zones yet.</td>
              </tr>
            ) : (
              zones.map((z) => (
                <tr key={z.id} className="row-clickable" onClick={() => setSelected(z)}>
                  <td>{z.zone_code}</td>
                  <td>{z.name}</td>
                  <td>{z.zone_type}</td>
                  <td>{z.island ?? '-'}</td>
                  <td>{z.region ?? '-'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                      <button type="button" className="icon-btn" aria-label="Edit zone" onClick={() => setEditing(z)}>
                        <Pencil size={16} />
                      </button>
                      <button type="button" className="icon-btn" aria-label="Delete zone" onClick={() => removeZone(z)}>
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

      {selected && (
        <div className="card quotes-page__card" style={{ marginTop: 16 }}>
          <div className="quotes-page__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ margin: 0 }}>
              Members — {selected.zone_code}{' '}
              <span className="text-muted-foreground" style={{ fontWeight: 400, fontSize: 13 }}>· {selected.name}</span>
            </h3>
            <button type="button" className="text-link" onClick={() => setSelected(null)}>Close</button>
          </div>

          <div style={addRow}>
            <select
              className="input input--sm"
              style={{ width: 150 }}
              value={mDraft.match_type}
              onChange={(e) => setMDraft({ ...mDraft, match_type: e.target.value as ZoneMember['match_type'] })}
            >
              {MATCH_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input className="input input--sm" style={{ width: 180 }} placeholder="value" value={mDraft.value} onChange={(e) => setMDraft({ ...mDraft, value: e.target.value })} />
            {mDraft.match_type === 'postcode_range' && (
              <input className="input input--sm" style={{ width: 120 }} placeholder="to" value={mDraft.value_to} onChange={(e) => setMDraft({ ...mDraft, value_to: e.target.value })} />
            )}
            <button type="button" className="btn btn--inline" style={{ marginTop: 0, marginLeft: 'auto' }} onClick={addMember}>Add</button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Type</th><th>Value</th><th>To</th><th aria-label="Actions" style={{ width: 60 }} /></tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-muted-foreground pad-inline">
                      No members. Bulk-seed via dashboard CSV into cartage_zone_members.
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr key={m.id}>
                      <td>{m.match_type}</td>
                      <td>{m.value}</td>
                      <td>{m.value_to ?? '-'}</td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button type="button" className="icon-btn" aria-label="Delete member" onClick={() => removeMember(m.id)}>
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
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit' : 'New'} zone</DialogTitle>
          </DialogHeader>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Code</label>
              <input className="input" value={editing?.zone_code ?? ''} onChange={(e) => setEditing({ ...editing!, zone_code: e.target.value })} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Name</label>
              <input className="input" value={editing?.name ?? ''} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Type</label>
              <select className="input" value={editing?.zone_type} onChange={(e) => setEditing({ ...editing!, zone_type: e.target.value as CartageZone['zone_type'] })}>
                <option value="area">area</option>
                <option value="port">port</option>
                <option value="depot">depot</option>
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Island</label>
              <select
                className="input"
                value={editing?.island ?? ''}
                onChange={(e) => setEditing({ ...editing!, island: (e.target.value || null) as CartageZone['island'] })}
              >
                <option value="">-</option>
                <option value="NI">NI</option>
                <option value="SI">SI</option>
              </select>
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Region</label>
              <input className="input" value={editing?.region ?? ''} onChange={(e) => setEditing({ ...editing!, region: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <button type="button" className="text-link" onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="btn btn--inline" style={{ marginTop: 0 }} onClick={saveZone}>Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
