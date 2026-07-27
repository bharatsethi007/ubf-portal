import { toast } from 'sonner'
import type { BulkUpdateFailure } from './boardBulkUpdate'

function formatFailures(failed: BulkUpdateFailure[], max = 3): string {
  const shown = failed.slice(0, max).map((f) => {
    const ref = f.booking_ref?.trim() || f.id.slice(0, 8)
    return `${ref} (${f.error})`
  })
  const extra = failed.length > max ? ` and ${failed.length - max} more` : ''
  return `${shown.join('; ')}${extra}`
}

export function toastBulkUpdateResult(
  actionLabel: string,
  succeeded: number,
  failed: BulkUpdateFailure[],
): void {
  if (failed.length === 0) {
    toast.success(`${actionLabel}: updated ${succeeded} booking${succeeded === 1 ? '' : 's'}`)
    return
  }
  if (succeeded === 0) {
    toast.error(`${actionLabel} failed for all ${failed.length} bookings`, {
      description: formatFailures(failed),
    })
    return
  }
  toast.warning(`${actionLabel}: ${succeeded} updated, ${failed.length} failed`, {
    description: formatFailures(failed),
  })
}
