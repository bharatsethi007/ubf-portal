import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ArrowLeftRight, X } from 'lucide-react'
import { fetchQuotePortCodes, type PortCodeRow, type PortPair } from './quotesStatsApi'

type Props = {
  value: PortPair
  onChange: (v: PortPair) => void
  portName: (code: string) => string
}

// Origin / destination pickers built from the ports actually on quotes,
// so every option returns results. Covers sea (UN/LOCODE) and air (IATA).
export default function QuotesPortFilter({ value, onChange, portName }: Props) {
  const [codes, setCodes] = useState<PortCodeRow[]>([])

  useEffect(() => {
    fetchQuotePortCodes().then(setCodes).catch(() => setCodes([]))
  }, [])

  const froms = useMemo(() => codes.filter((c) => c.side === 'from'), [codes])
  const tos = useMemo(() => codes.filter((c) => c.side === 'to'), [codes])
  const label = (c: PortCodeRow) => {
    const name = portName(c.code)
    return name && name !== c.code ? `${c.code} · ${name} (${c.n})` : `${c.code} (${c.n})`
  }
  const active = Boolean(value.from || value.to)

  return (
    <div className="mr-auto flex items-center gap-1.5">
      <select
        className="input input--sm w-44"
        aria-label="Origin port"
        value={value.from ?? ''}
        onChange={(e) => onChange({ ...value, from: e.target.value || null })}
      >
        <option value="">Any origin</option>
        {froms.map((c) => <option key={c.code} value={c.code}>{label(c)}</option>)}
      </select>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        title={active ? 'Swap origin and destination' : 'Port pair'}
        disabled={!active}
        onClick={() => onChange({ from: value.to, to: value.from })}
      >
        {active ? <ArrowLeftRight size={15} /> : <ArrowRight size={15} />}
      </button>
      <select
        className="input input--sm w-44"
        aria-label="Destination port"
        value={value.to ?? ''}
        onChange={(e) => onChange({ ...value, to: e.target.value || null })}
      >
        <option value="">Any destination</option>
        {tos.map((c) => <option key={c.code} value={c.code}>{label(c)}</option>)}
      </select>
      {active && (
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          title="Clear port pair"
          onClick={() => onChange({ from: null, to: null })}
        >
          <X size={15} />
        </button>
      )}
    </div>
  )
}
