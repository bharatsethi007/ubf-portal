import { Trash2 } from 'lucide-react'
import type { BookingComm } from './commsTypes'
import {
  CATEGORIES, DIRECTIONS, SENTIMENTS, COMPLAINT_TYPES, COMPLAINT_SEVERITIES, COMPLAINT_STATUSES, labelFor,
} from './commsTypes'
import { ACTIVITY_ICON, authorInitials, sentimentClass, severityClass, timeLabel } from './commsFormat'

type Props = { comm: BookingComm; canDelete: boolean; onDelete: (comm: BookingComm) => void }

function renderBody(text: string) {
  return text.split(/(@[a-zA-Z0-9._-]+)/g).map((p, i) =>
    /^@[a-zA-Z0-9._-]+$/.test(p)
      ? <span key={i} className="comms-mention-chip">{p}</span>
      : <span key={i}>{p}</span>,
  )
}

export default function CommsBubble({ comm, canDelete, onDelete }: Props) {
  const Icon = ACTIVITY_ICON[comm.activity_type]
  const side = comm.direction === 'outgoing' ? 'out' : comm.direction === 'incoming' ? 'in' : 'internal'
  const isComplaint = comm.category === 'complaint'

  return (
    <div className={`comms-row comms-row--${side}`}>
      <div className="comms-avatar" title={comm.author_email ?? ''}>{authorInitials(comm)}</div>
      <div className={`comms-bubble comms-bubble--${side}${isComplaint ? ' comms-bubble--complaint' : ''}`}>
        <div className="comms-bubble__head">
          <span className="comms-bubble__type"><Icon size={13} /> {labelFor(DIRECTIONS, comm.direction)}</span>
          <span className="comms-cat">{labelFor(CATEGORIES, comm.category)}</span>
          {comm.sentiment ? <span className={sentimentClass(comm.sentiment)}>{labelFor(SENTIMENTS, comm.sentiment)}</span> : null}
          <span className="comms-bubble__time">{timeLabel(comm.occurred_at)}</span>
          {canDelete ? (
            <button type="button" className="comms-bubble__del" title="Delete entry (admin)" onClick={() => onDelete(comm)}>
              <Trash2 size={12} />
            </button>
          ) : null}
        </div>

        {isComplaint ? (
          <div className="comms-complaint-bar">
            <span className="comms-complaint-badge">COMPLAINT</span>
            {comm.complaint_type ? <span className="comms-complaint-tag">{labelFor(COMPLAINT_TYPES, comm.complaint_type)}</span> : null}
            {comm.complaint_severity ? <span className={severityClass(comm.complaint_severity)}>{labelFor(COMPLAINT_SEVERITIES, comm.complaint_severity)}</span> : null}
            {comm.complaint_status ? <span className="comms-complaint-status">{labelFor(COMPLAINT_STATUSES, comm.complaint_status)}</span> : null}
          </div>
        ) : null}

        {comm.subject ? <div className="comms-bubble__subject">{comm.subject}</div> : null}
        {comm.contact_name ? <div className="comms-bubble__contact">{comm.contact_name}</div> : null}
        <div className="comms-bubble__body">{renderBody(comm.body)}</div>
      </div>
    </div>
  )
}
