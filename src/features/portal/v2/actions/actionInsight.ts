import { dayDiff, nzToday, plusDays, shortDay, type PortalContainerDates, type PortalTask } from './portalActionsApi'

/** One plain-English tip per action, from dates we hold. Deterministic, no AI. Null when there's nothing useful to say. */
export function actionInsight(task: PortalTask, mine: PortalContainerDates[], suggested: string | null, today = nzToday()): string | null {
  const first = (xs: (string | null)[]) => xs.filter((x): x is string => !!x).sort()[0] ?? null
  const portLfd = first(mine.map((d) => d.port_last_free_day))
  const ldd = (task.payload?.last_detention_day as string | undefined) ?? first(mine.map((d) => d.last_detention_day))
  const estimate = mine.some((d) => d.detention_is_estimate)

  if (task.kind === 'confirm_delivery') {
    if (portLfd) {
      const left = dayDiff(today, portLfd)
      if (left < 0) return `Port free storage ended ${shortDay(portLfd)}. Storage is adding up daily, so the sooner the better.`
      if (left === 0) return 'Today is the last free day at the port. Confirm now and we will try to collect today.'
      return `Port storage is free until ${shortDay(portLfd)}. We suggest ${shortDay(suggested)} so the container is out before charges start.`
    }
    return `The port hasn't published free storage dates yet. ${shortDay(suggested)} is a safe pick, and we'll flag it here if that changes.`
  }

  if (task.kind === 'empty_ready' && ldd) {
    const left = dayDiff(today, ldd)
    if (estimate) return `Free time should end around ${shortDay(ldd)}. It firms up once the vessel discharges.`
    if (left < 0) return `Free time ended ${shortDay(ldd)}, so detention is adding up each day. Tell us the moment it's empty.`
    if (left <= 2) return `Free time ends ${shortDay(ldd)}. Ready today gives us time to return it before detention starts.`
    return `Free time ends ${shortDay(ldd)}. If it's ready by ${shortDay(plusDays(ldd, -2))}, we can return it with no detention.`
  }

  if (task.kind === 'upload_docs') {
    return 'We lodge your customs entry with these. Uploading early avoids clearance delays and storage at the port.'
  }

  return null
}
