import SlideDrawer from '../SlideDrawer'
import { formatRefDate, type ReferenceJob } from './jobsReferenceApi'

type Props = {
  job: ReferenceJob | null
  open: boolean
  onClose: () => void
  onCopyCargo: (job: ReferenceJob) => void
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  const v = value == null || value === '' ? '—' : String(value)
  return (
    <div className="bf-ref-detail__row">
      <dt>{label}</dt>
      <dd>{v}</dd>
    </div>
  )
}

export default function ReferenceJobDrawer({ job, open, onClose, onCopyCargo }: Props) {
  if (!job) return null

  return (
    <SlideDrawer
      open={open}
      onClose={onClose}
      ariaLabel="Reference job detail"
      wide
      footer={
        <button type="button" className="bf-btn bf-btn--primary" onClick={() => { onCopyCargo(job); onClose() }}>
          Copy cargo to booking
        </button>
      }
    >
      <h2 className="bf-ref-detail__title mono">{job.house_bill || 'Job reference'}</h2>
      <p className="bf-ref-detail__sub muted">
        {[job.origin, job.destination].filter(Boolean).join(' → ')}
        {job.relevant_date ? ` · ${formatRefDate(job.relevant_date)}` : ''}
      </p>
      <dl className="bf-ref-detail">
        <Row label="Status" value={job.status} />
        <Row label="House bill" value={job.house_bill} />
        <Row label="Master bill" value={job.master_bill} />
        <Row label="Origin" value={job.origin} />
        <Row label="Destination" value={job.destination} />
        <Row label="ETD" value={job.etd} />
        <Row label="ETA" value={job.eta} />
        <Row label="Vessel / flight" value={job.vessel_flight} />
        <Row label="Mode" value={job.mode} />
        <Row label="Direction" value={job.direction} />
        <Row label="Commodity" value={job.commodity} />
        <Row label="Goods description" value={job.goods_desc} />
        <Row label="Pieces" value={job.pack_qty} />
        <Row label="Packing type" value={job.pack_type} />
        <Row label="Weight kg" value={job.weight_kg} />
        <Row label="Volume m³" value={job.volume_m3} />
      </dl>
    </SlideDrawer>
  )
}
