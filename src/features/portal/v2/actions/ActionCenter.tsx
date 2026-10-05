import { useState } from 'react'
import { detailPath } from '../homeModel'
import TaskActionRow from './TaskActionRow'
import type { PortalBookingRef, PortalContainerDates, PortalTask } from './portalActionsApi'

type Props = {
  tasks: PortalTask[]
  dates: PortalContainerDates[]
  refs: Map<string, PortalBookingRef>
  busy: string | null
  onRespond: (t: PortalTask, r: Record<string, unknown>) => Promise<boolean>
}

/** Home: what UB Freight needs from you, one tap each. Hidden when nothing is open. */
export default function ActionCenter({ tasks, dates, refs, busy, onRespond }: Props) {
  const [all, setAll] = useState(false)
  if (tasks.length === 0) return null
  const shown = all ? tasks : tasks.slice(0, 5)
  return (
    <section id="actions" className="pv3-card pv3-rise" style={{ padding: 20, animationDelay: '.06s' }}>
      <header className="pv3-card__head">
        <h2>Your actions <span className="pv3-count pv3-count--red">{tasks.length}</span></h2>
        <span className="pv3-muted" style={{ fontSize: 12 }}>We update your shipment as soon as you respond</span>
      </header>
      <div>
        {shown.map((t) => {
          const ref = refs.get(t.booking_id)
          const ship = ref?.shipment_id ?? null
          return (
            <TaskActionRow
              key={t.id}
              task={t}
              bookingRef={[ref?.booking_ref, ref?.customer_ref ? `PO ${ref.customer_ref}` : null].filter(Boolean).join(' · ') || null}
              dates={dates}
              busy={busy === t.id}
              docsTo={ship != null ? detailPath({ job_unique: ship }, 'Documents') : null}
              onRespond={(r) => onRespond(t, r)}
            />
          )
        })}
      </div>
      {tasks.length > 5 && (
        <button type="button" className="pv3-textbtn" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${tasks.length}`}
        </button>
      )}
    </section>
  )
}
