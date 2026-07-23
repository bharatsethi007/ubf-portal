import { fmtBoardDate } from '../importSeaBoardFormat'
import { lfdClass } from '../importSeaRowUtils'

type Props = {
  value: string | null
  /** Apply LFD urgency colours (amber ≤2 days, red past). */
  lfd?: boolean
}

export default function BoardDateCell({ value, lfd = false }: Props) {
  const className = [
    'mono',
    'import-sea-date',
    lfd ? lfdClass(value) : '',
  ]
    .filter(Boolean)
    .join(' ')

  return <span className={className}>{fmtBoardDate(value)}</span>
}
