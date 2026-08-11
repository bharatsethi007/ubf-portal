import { Globe, Ship, Boxes } from 'lucide-react'
import { useMemo } from 'react'
import { useSeaPorts } from '../../hooks/useSeaPorts'
import './quoteLaneMap.css'

type Resolved = { code: string; name: string; cc: string | null }

function Flag({ cc }: { cc: string | null }) {
  if (cc && /^[a-z]{2}$/.test(cc)) return <span className={`fi fi-${cc} qlane__flag`} aria-hidden />
  return <Globe size={16} className="qlane__globe" aria-hidden />
}

function PortLabel({ side, p }: { side: 'o' | 'd'; p: Resolved | null }) {
  return (
    <span className="qlane__port">
      <span className={`qlane__dot qlane__dot--${side}`} />
      <Flag cc={p?.cc ?? null} />
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span className="qlane__code mono">{p?.code ?? '—'}</span>
        <span className="qlane__name">
          {p?.name ?? '—'}{p ? ` · ${side === 'o' ? 'loading port' : 'final port'}` : ''}
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
  mode?: 'fcl' | 'lcl'
}) {
  const { ports } = useSeaPorts()
  const resolve = (code: string | null): Resolved | null => {
    if (!code) return null
    const p = ports.find((x) => x.code === code)
    return p ? { code: p.code, name: p.name, cc: p.country_code } : { code, name: code, cc: null }
  }
  const from = useMemo(() => resolve(fromCode), [fromCode, ports])
  const to = useMemo(() => resolve(toCode), [toCode, ports])

  return (
    <div className="qlane">
      <div className="qlane__ports">
        <PortLabel side="o" p={from} />
        <span className="qlane__conn">
          <span className="qlane__dash" />
          <span className="qlane__ship">{mode === 'lcl' ? <Boxes size={14} /> : <Ship size={14} />}</span>
          <span className="qlane__dash" />
        </span>
        <PortLabel side="d" p={to} />
      </div>
    </div>
  )
}
