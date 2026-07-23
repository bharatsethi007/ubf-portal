import BoardDateCell from './BoardDateCell'
import BoardPortConnectDot from './BoardPortConnectDot'

type Props = {
  value: string | null
  source?: string | null
  lastSync?: string | null
  lfd?: boolean
}

export default function BoardSourcedDateCell({ value, source, lastSync, lfd }: Props) {
  const fromPc = source === 'portconnect'
  return (
    <span className="import-sea-sourced-cell">
      {fromPc ? <BoardPortConnectDot lastSync={lastSync} /> : null}
      <BoardDateCell value={value} lfd={lfd} />
    </span>
  )
}
