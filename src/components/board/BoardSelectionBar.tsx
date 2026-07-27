import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export type BoardBulkAction = {
  id: string
  label: string
  icon?: ReactNode
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  popover?: ReactNode
}

export type BoardSelectionProgress = {
  label: string
  done: number
  total: number
}

type Props = {
  count: number
  onClear: () => void
  actions: BoardBulkAction[]
  progress?: BoardSelectionProgress | null
}

export default function BoardSelectionBar({ count, onClear, actions, progress }: Props) {
  if (count === 0) return null

  return (
    <div className="board-selection-bar card pad-inline">
      <div className="board-selection-bar__meta">
        <span className="board-selection-bar__count">{count} selected</span>
        <button type="button" className="text-link board-selection-bar__clear" onClick={onClear}>
          Clear
        </button>
        {progress ? (
          <span className="muted board-selection-bar__progress">
            {progress.label} {progress.done}/{progress.total}
          </span>
        ) : null}
      </div>
      <div className="board-selection-bar__actions">
        {actions.map((action) =>
          action.popover ? (
            <span key={action.id} className="board-selection-bar__action">
              {action.popover}
            </span>
          ) : (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant="outline"
              disabled={action.disabled || action.loading}
              onClick={action.onClick}
            >
              {action.icon}
              {action.label}
            </Button>
          ),
        )}
      </div>
    </div>
  )
}
