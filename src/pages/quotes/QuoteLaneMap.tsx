import { Globe, Ship, Boxes, Plane } from 'lucide-react'
import { useMemo } from 'react'
import { useSeaPorts } from '../../hooks/useSeaPorts'
import { findAirport } from '../../utils/filterAirports'
import './quoteLaneMap.css'

type Resolved = { code: string; name: string; cc: string | null }

function Flag({ cc }: { cc: string | null }) {
  if (cc && /^[a-z]{2}$/.test(cc)) return <span className={`fi fi-${cc} qlane__flag`} aria-hidden />
  return <Globe size={16} className="qlane__globe" aria-hidden />
}

function PortLabel({ side, p, mode }: { side: 'o' | 'd'; p: Resolved | null; mode: 'fcl' | 'lcl' | 'air' }) {
  const originWord = mode === 'air' ? 'origin airport' : 'loading port'
  const destWord = mode === 'air' ? 'destination airport' : 'final port'
  return (
    <span className="qlane__port">
      <span className={`qlane__dot qlane__dot--${side}`} />
      <Flag cc={p?.cc ?? null} />
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span className="qlane__code mono">{p?.code ?? '—'}</span>
        <span className="qlane__name">
          {p?.name ?? '—'}{p ? ` · ${side === 'o' ? originWord : destWord}` : ''}
        </span>
      </span>
    </span>
  )
}

export default function QuoteLaneMap({
  fromCode,
  toCode,
  mode = 'fcl',
}: {
  fromCode: string | null
  toCode: string | null
  mode?: 'fcl' | 'lcl' | 'air'
}) {
  const { ports } = useSeaPorts()
  const resolve = (code: string | null): Resolved | null => {
    if (!code) return null
    if (mode === 'air') {
      const a = findAirport(code)
      const cc = a && /^[a-z]{2}$/i.test((a.country ?? '').trim()) ? a.country.trim().toLowerCase() : null
      return a ? { code: a.iata, name: a.city || a.name, cc } : { code, name: code, cc: null }
    }
    const p = ports.find((x) => x.code === code)
    return p ? { code: p.code, name: p.name, cc: p.country_code } : { code, name: code, cc: null }
  }
  const from = useMemo(() => resolve(fromCode), [fromCode, ports, mode])
  const to = useMemo(() => resolve(toCode), [toCode, ports, mode])

  return (
    <div className="qlane">
      <div className="qlane__ports">
        <PortLabel side="o" p={from} mode={mode} />
        <span className="qlane__conn">
          <span className="qlane__dash" />
          <span className="qlane__ship">{mode === 'air' ? <Plane size={14} /> : mode === 'lcl' ? <Boxes size={14} /> : <Ship size={14} />}</span>
          <span className="qlane__dash" />
        </span>
        <PortLabel side="d" p={to} mode={mode} />
      </div>
    </div>
  )
}
