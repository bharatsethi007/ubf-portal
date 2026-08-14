import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  containerNoValidationMessage,
  normalizeContainerNo,
} from '@/features/bookingRecord/containers/containerIso6346'
import { CONTAINER_TYPE_OPTIONS } from '@/features/bookingRecord/containers/bookingContainerTypes'

export type DraftContainerRow = {
  id: string
  container_no: string
  container_type: string
  seal_no: string
}

type Props = {
  rows: DraftContainerRow[]
  onChange: (rows: DraftContainerRow[]) => void
}

function newRow(): DraftContainerRow {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    container_no: '',
    container_type: '',
    seal_no: '',
  }
}

export function emptyDraftContainerRow(): DraftContainerRow {
  return newRow()
}

export function draftContainersForSave(rows: DraftContainerRow[]): Array<{
  container_no: string
  container_type: string | null
  seal_no: string | null
}> {
  return rows
    .map((row) => ({
      container_no: normalizeContainerNo(row.container_no),
      container_type: row.container_type.trim() || null,
      seal_no: row.seal_no.trim() || null,
    }))
    .filter((row) => row.container_no.length > 0)
}

export function firstContainerValidationError(rows: DraftContainerRow[]): string | null {
  for (const row of rows) {
    const normalized = normalizeContainerNo(row.container_no)
    if (!normalized) continue
    const message = containerNoValidationMessage(normalized)
    if (message) return message
  }
  return null
}

export default function CreateImportSeaContainerList({ rows, onChange }: Props) {
  function updateRow(id: string, patch: Partial<DraftContainerRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function removeRow(id: string) {
    onChange(rows.filter((row) => row.id !== id))
  }

  return (
    <div className="create-import-sea-containers">
      <span className="filter-field__label">Container numbers</span>
      {rows.length > 0 ? (
        <div className="create-import-sea-containers__list">
          {rows.map((row) => {
            const normalized = normalizeContainerNo(row.container_no)
            const warning = normalized ? containerNoValidationMessage(normalized) : null
            return (
              <div key={row.id} className="create-import-sea-containers__row">
                <div className="create-import-sea-containers__no">
                  <Input
                    className="input--xs mono"
                    value={row.container_no}
                    placeholder="ABCD1234567"
                    onChange={(e) =>
                      updateRow(row.id, { container_no: normalizeContainerNo(e.target.value) })
                    }
                  />
                  {warning ? <p className="booking-container-row__warn">{warning}</p> : null}
                </div>
                <select
                  className="input input--xs"
                  value={row.container_type}
                  onChange={(e) => updateRow(row.id, { container_type: e.target.value })}
                >
                  <option value="">Type…</option>
                  {CONTAINER_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove container"
                  onClick={() => removeRow(row.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="muted create-import-sea-containers__empty">Optional — add if known.</p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="create-import-sea-containers__add"
        onClick={() => onChange([...rows, newRow()])}
      >
        <Plus size={14} />
        Add container
      </Button>
    </div>
  )
}
