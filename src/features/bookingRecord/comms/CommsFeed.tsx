import { useEffect, useRef } from 'react'
import type { BookingComm } from './commsTypes'
import { groupByDate } from './commsFormat'
import CommsBubble from './CommsBubble'

type Props = { comms: BookingComm[]; loading: boolean; canDelete: boolean; onDelete: (comm: BookingComm) => void }

export default function CommsFeed({ comms, loading, canDelete, onDelete }: Props) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [comms.length])

  if (loading) return <div className="comms-feed__empty">Loading…</div>
  if (!comms.length) return <div className="comms-feed__empty">No comms logged yet. Add the first entry.</div>
  return (
    <div className="comms-feed">
      {groupByDate(comms).map((g) => (
        <div key={g.label} className="comms-feed__group">
          <div className="comms-feed__date"><span>{g.label}</span></div>
          {g.items.map((c) => <CommsBubble key={c.id} comm={c} canDelete={canDelete} onDelete={onDelete} />)}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}
