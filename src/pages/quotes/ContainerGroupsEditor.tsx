import { Plus, X } from 'lucide-react'
import {
  emptyContainerGroup,
  type ContainerSize,
  type ContainerType,
  type QuoteContainerDraft,
} from './quoteContainersApi'

const SIZES: { value: ContainerSize; label: string }[] = [
  { value: '20', label: '20ft' },
  { value: '20HC', label: '20ft HC' },
  { value: '40', label: '40ft' },
  { value: '40HC', label: '40ft HC' },
]

const TYPES: { value: ContainerType; label: string }[] = [
  { value: 'standard', label: 'Standard (dry)' },
  { value: 'reefer', label: 'Reefer' },
  { value: 'opentop', label: 'Open top' },
  { value: 'flatrack', label: 'Flat rack' },
  { value: 'isotank', label: 'ISO tank' },
  { value: 'openside', label: 'Open side' },
]

type Props = {
  groups: QuoteContainerDraft[]
  onChange: (groups: QuoteContainerDraft[]) => void
  onApply: () => void
  onCancel: () => void
}

export default function ContainerGroupsEditor({ groups, onChange, onApply, onCancel }: Props) {
  function patchGroup(idx: number, p: Partial<QuoteContainerDraft>) {
    onChange(groups.map((g, i) => (i === idx ? { ...g, ...p } : g)))
  }
  function addGroup() {
    onChange([...groups, emptyContainerGroup(groups.length)])
  }
  function removeGroup(idx: number) {
    if (groups.length === 1) return
    onChange(groups.filter((_, i) => i !== idx))
  }

  return (
    <div className="nqs-loads-panel">
      {groups.map((g, idx) => (
        <div className="cg-card" key={idx}>
          <h4 className="cg-card__title">Container group {idx + 1}</h4>
          {groups.length > 1 && (
            <button type="button" className="cg-card__remove" onClick={() => removeGroup(idx)} aria-label="Remove group">
              <X size={16} />
            </button>
          )}

          <div className="cg-label">Container size</div>
          <div className="cg-chips">
            {SIZES.map((s) => (
              <button
                type="button"
                key={s.value}
                className={`cg-chip${g.container_size === s.value ? ' cg-chip--on' : ''}`}
                onClick={() => patchGroup(idx, { container_size: s.value })}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="cg-label">Container type</div>
          <div className="cg-chips">
            {TYPES.map((t) => (
              <button
                type="button"
                key={t.value}
                className={`cg-chip${g.container_type === t.value ? ' cg-chip--on' : ''}`}
                onClick={() => patchGroup(idx, { container_type: t.value })}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="cg-grid">
            <div>
              <div className="cg-label">No. of containers</div>
              <input
                type="number"
                min={1}
                value={g.qty}
                onChange={(e) => patchGroup(idx, { qty: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
            <div>
              <div className="cg-label">Weight per ctr. (MT)</div>
              <input
                type="number"
                placeholder="Type here…"
                value={g.weight_per_container_mt ?? ''}
                onChange={(e) =>
                  patchGroup(idx, {
                    weight_per_container_mt: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <div className="cg-label">Commodity</div>
              <input
                type="text"
                placeholder="General"
                value={g.commodity ?? ''}
                onChange={(e) => patchGroup(idx, { commodity: e.target.value || null })}
              />
            </div>
          </div>

          {idx === groups.length - 1 && (
            <div className="cg-actions">
              <button type="button" className="cg-add" onClick={addGroup}>
                <Plus size={15} /> Add another group
              </button>
              <div>
                <button type="button" className="cg-cancel" onClick={onCancel}>Cancel</button>
                <button type="button" className="cg-apply" onClick={onApply}>Apply</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
