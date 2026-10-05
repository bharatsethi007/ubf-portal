import { detailPath, type Exception } from '../homeModel'
import { dayDiff, nzToday, shortDay, type PortalBookingRef, type PortalContainerDates, type PortalTask } from './portalActionsApi'

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** Container free-time and overdue-task exceptions for Home. Deterministic, from portal_container_dates + open tasks. */
export function actionExceptions(
  dates: PortalContainerDates[],
  tasks: PortalTask[],
  refs: Map<string, PortalBookingRef>,
  today = nzToday(),
): Exception[] {
  const out: Exception[] = []

  for (const d of dates) {
    if (d.empty_returned_on) continue
    const c = d.container_no
    const ref = d.booking_ref ?? 'your booking'
    const to = d.shipment_id != null ? detailPath({ job_unique: d.shipment_id }) : '/portal#actions'
    const link = { label: d.shipment_id != null ? 'View shipment' : 'Your actions', to }
    const ask = (subject: string, draft: string) => ({ job: d.shipment_id, subject, draft })
    const ready = d.empty_ready_at != null
    let flagged = false

    if (d.gated_out_on && d.last_detention_day && !d.detention_is_estimate) {
      const left = dayDiff(today, d.last_detention_day)
      if (left < 0) {
        flagged = true
        out.push({
          key: `det-${d.booking_id}-${c}`, id: d.shipment_id ?? undefined, tone: 'red', kind: 'Detention',
          title: `${c} past free time by ${plural(-left, 'day')}`, sub: `${ref} · free time ended ${shortDay(d.last_detention_day)}`,
          to, sort: 200 - left,
          why: `The shipping line gives ${d.detention_free_days} free days from discharge. That ended ${shortDay(d.last_detention_day)}, so detention charges are adding up each day until the empty is back.`,
          next: ready ? 'You marked the empty ready. We are arranging the pickup now.' : 'Tell us the empty is ready and we will collect it straight away.',
          ask: ask(`Empty return: ${c}`, `Hi team, ${c} on ${ref} is past free time. The empty will be ready on `),
          link,
        })
      } else if (left <= 3 && !ready) {
        flagged = true
        out.push({
          key: `det-${d.booking_id}-${c}`, id: d.shipment_id ?? undefined, tone: left <= 1 ? 'red' : 'amber', kind: 'Detention',
          title: left === 0 ? `${c} free time ends today` : `${c} free time ends ${shortDay(d.last_detention_day)}`,
          sub: `${ref} · ${plural(left, 'day')} left`, to, sort: 120 - left,
          why: `Free time with the shipping line ends ${shortDay(d.last_detention_day)}. After that, detention charges apply each day until the empty is returned.`,
          next: 'Tell us when the empty is ready so we can book the pickup in time.',
          ask: ask(`Empty return: ${c}`, `Hi team, the empty ${c} on ${ref} will be ready on `),
          link,
        })
      }
    }

    if (!d.gated_out_on && d.port_last_free_day && (d.port_status === 'overdue' || d.port_status === 'today' || d.port_status === 'soon')) {
      const left = dayDiff(today, d.port_last_free_day)
      out.push({
        key: `lfd-${d.booking_id}-${c}`, id: d.shipment_id ?? undefined, tone: left <= 0 ? 'red' : 'amber', kind: 'Storage',
        title: left < 0 ? `${c} past last free day at port` : left === 0 ? `${c} last free day at port is today` : `${c} last free day at port ${shortDay(d.port_last_free_day)}`,
        sub: `${ref} · ${d.planned_delivery_date ? `delivery planned ${shortDay(d.planned_delivery_date)}` : 'no delivery date yet'}`,
        to, sort: 140 - left,
        why: `The port gives free storage until ${shortDay(d.port_last_free_day)}. After that, the port charges storage each day the container stays there.`,
        next: d.planned_delivery_date ? 'Delivery is planned. We will tell you if anything changes.' : 'Confirm a delivery date so we can collect it before storage starts.',
        ask: ask(`Delivery: ${c}`, `Hi team, please deliver ${c} on ${ref} on `),
        link,
      })
    }

    if (!flagged && !ready && d.return_after_free_time && d.planned_return_date && d.last_detention_day) {
      out.push({
        key: `ret-${d.booking_id}-${c}`, id: d.shipment_id ?? undefined, tone: 'amber', kind: 'Detention',
        title: `${c} empty planned after free time`, sub: `${ref} · ready ${shortDay(d.planned_return_date)}, free time ends ${shortDay(d.last_detention_day)}`,
        to, sort: 80,
        why: `You told us the empty will be ready ${shortDay(d.planned_return_date)}. Free time ends ${shortDay(d.last_detention_day)}, so ${plural(dayDiff(d.last_detention_day, d.planned_return_date), 'day')} of detention may apply.`,
        next: 'If it can be ready sooner, update the date and we will move the pickup.',
        ask: ask(`Empty return: ${c}`, `Hi team, about the empty ${c} on ${ref}: `),
        link,
      })
    }
  }

  for (const t of tasks) {
    if (!t.due_date || t.due_date >= today) continue
    const ref = refs.get(t.booking_id)
    const late = dayDiff(t.due_date, today)
    out.push({
      key: `task-${t.id}`, id: ref?.shipment_id ?? undefined, tone: 'red', kind: 'Action',
      title: `${t.title} is overdue`, sub: `${ref?.booking_ref ?? ''} · was due ${shortDay(t.due_date)}`.replace(/^ · /, ''),
      to: '/portal#actions', sort: 150 + late,
      why: `We asked for this by ${shortDay(t.due_date)}. Your shipment can't move to the next step until it's done.`,
      next: 'Open your actions on Home and respond. It only takes a tap.',
      ask: { job: ref?.shipment_id ?? null, subject: t.title, draft: `Hi team, about "${t.title}": ` },
      link: { label: 'Your actions', to: '/portal#actions' },
    })
  }

  return out
}
