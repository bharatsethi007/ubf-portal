import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  customsState,
  customsTooltip,
  mpiState,
  mpiTooltip,
  type CustomsPillState,
} from '../importSeaCustoms'
import type { ImportSeaRow } from '../types'

function cls(state: CustomsPillState): string {
  if (state === 'on') return 'import-sea-ops__on'
  if (state === 'warn') return 'import-sea-ops__warn'
  return 'import-sea-ops__off'
}

/** CUS + MPI from UBF's own customs entry in CyberFreight (CUSTMAIN). */
export default function CustomsPills({ row }: { row: ImportSeaRow }) {
  const c = row.customs ?? null
  const pills = [
    { label: 'CUS', state: customsState(c), tip: customsTooltip(c) },
    { label: 'MPI', state: mpiState(c), tip: mpiTooltip(c) },
  ]
  return (
    <>
      {pills.map((p) => (
        <Tooltip key={p.label}>
          <TooltipTrigger render={<span className={cls(p.state)}>{p.label}</span>} />
          <TooltipContent>{p.tip}</TooltipContent>
        </Tooltip>
      ))}
    </>
  )
}
