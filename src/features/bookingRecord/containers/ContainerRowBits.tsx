import { TriangleAlert } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { hazardCountFromList, hazardTooltipText, normalizeHazards } from './hazardUtils'
import { weightFlag } from './weightFlag'

/** One grid for header + rows: dot · number · type · weight · action. Nothing wraps. */
export const ROW_GRID: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '10px minmax(0, 1fr) 66px 86px 22px', gap: 6, alignItems: 'center',
}

/** Red warning after the container number when PortConnect reports dangerous goods. */
export function HazardBang({ hazards, hazardCount }: { hazards?: unknown; hazardCount?: number | null }) {
  const list = normalizeHazards(hazards)
  const count = hazardCountFromList(list, hazardCount ?? 0)
  if (count <= 0) return null
  const tip = hazardTooltipText(list, count) ?? 'Hazardous cargo'
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span aria-label={`Hazardous: ${tip}`} style={{ display: 'inline-flex', color: '#D92D20', flexShrink: 0, cursor: 'help' }}>
            <TriangleAlert size={14} strokeWidth={2.4} />
          </span>
        }
      />
      <TooltipContent>{tip.split('\n').map((l) => <div key={l}>{l}</div>)}</TooltipContent>
    </Tooltip>
  )
}

const TONE: Record<string, { bg: string; fg: string }> = {
  'wflag--heavy': { bg: '#FEF7C3', fg: '#854A0E' },
  'wflag--very': { bg: '#FEE4E2', fg: '#B42318' },
  'wflag--super': { bg: '#B42318', fg: '#FFFFFF' },
}

/** Weight with the heavy flag folded in: the number itself turns into the coloured pill. Click acknowledges. */
export function WeightCell({ kg, acknowledged, onToggleAck }: { kg: number | null; acknowledged?: boolean; onToggleAck?: () => void }) {
  if (kg == null) return <span style={{ fontSize: 11, color: '#98A2B3', textAlign: 'right' }}>—</span>
  const text = `${kg.toLocaleString()} kg`
  const f = weightFlag(kg)
  if (!f) return <span style={{ fontSize: 11, textAlign: 'right', whiteSpace: 'nowrap' }}>{text}</span>
  const t = TONE[f.className] ?? TONE['wflag--heavy']
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggleAck?.() }}
      title={`${f.label}${acknowledged ? ' (acknowledged, click to un-flag)' : ', click to acknowledge'}`}
      style={{
        justifySelf: 'end', border: 0, borderRadius: 999, padding: '1px 7px', fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap',
        cursor: 'pointer', background: t.bg, color: t.fg, opacity: acknowledged ? 0.55 : 1, textDecoration: acknowledged ? 'line-through' : undefined,
      }}
    >
      {text}
    </button>
  )
}
