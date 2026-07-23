import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy } from 'lucide-react'
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
  const [copied, setCopied] = useState(false)
  const ref = value?.trim() || ''

  async function copy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!ref) return
    try {
      await navigator.clipboard.writeText(ref)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  if (!ref) return <>—</>

  return (
    <span className="master-bill-field__value">
      {onHold ? <span className="import-sea-dot import-sea-dot--hold" aria-hidden /> : null}
      {!matched && !onHold ? (
        <span
          className="import-sea-dot import-sea-dot--unmatched"
          title="Not yet matched in ERP"
          aria-hidden
        />
      ) : null}
      <Link to={bookingRecordHref(bookingId, boardParams)} className="link-mono">
        {ref}
      </Link>
      <button
        type="button"
        className="master-bill-field__copy"
        onClick={copy}
        title="Copy booking reference"
      >
        <Copy size={14} />
      </button>
      {copied ? <span className="master-bill-field__copied muted">Copied</span> : null}
    </span>
  )
}
