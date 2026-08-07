import { Link } from 'react-router-dom'
import { bookingRecordHref } from '../importSeaFilterUrl'

type Props = {
  bookingId: string
  value: string | null
  onHold: boolean
  matched: boolean
  boardParams: URLSearchParams
}

export default function BookingRefCell({
  bookingId,
  value,
  onHold,
  matched,
  boardParams,
}: Props) {
  const ref = value?.trim() || ''
  if (!ref) return <>—</>

  return (
    <span className="import-sea-bref-cell">
      {onHold ? (
        <span className="import-sea-dot import-sea-dot--hold" aria-hidden />
      ) : !matched ? (
        <span className="import-sea-dot import-sea-dot--unmatched" title="Not yet matched in ERP" aria-hidden />
      ) : (
        <span className="import-sea-dot import-sea-dot--synced" title="Linked to ERP shipment" aria-hidden />
      )}
      <Link to={bookingRecordHref(bookingId, boardParams)} className="link-mono">
        {ref}
      </Link>
    </span>
  )
}
