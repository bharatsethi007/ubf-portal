import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { clearancePillState } from '@/features/clearance/clearanceLayers'
import type { ImportSeaRow } from './types'

const OPS_STEPS = [
  { key: 'swb_released', label: 'SWB' },
  { key: 'tlx_release_on_hand', label: 'TLX' },
  { key: 'bacc_sent', label: 'BACC' },
] as const satisfies ReadonlyArray<{ key: keyof ImportSeaRow; label: string }>

const CLEARANCE_STEPS = [
  {
    label: 'PORT',
    tooltip: 'Port clearance — MPI and Customs both released (PortConnect)',
    state: (row: ImportSeaRow) =>
      clearancePillState(Boolean(row.port_cleared), Boolean(row.port_clearance_cancelled)),
  },
  {
    label: 'LINE',
    tooltip: 'Line release — port charges paid to the shipping line (PortConnect)',
    state: (row: ImportSeaRow) =>
      clearancePillState(Boolean(row.line_released), Boolean(row.line_release_cancelled)),
  },
  {
    label: 'UBF',
    tooltip: 'UBF clearance at consignee level (manual)',
    state: (row: ImportSeaRow) => clearancePillState(Boolean(row.cleared), false),
  },
] as const

type Props = { row: ImportSeaRow }

function pillClass(state: ReturnType<typeof clearancePillState>): string {
  if (state === 'on') return 'import-sea-ops__on'
  if (state === 'warn') return 'import-sea-ops__warn'
  return 'import-sea-ops__off'
}

export default function ImportSeaOpsStatus({ row }: Props) {
  return (
    <span className="import-sea-ops">
      {OPS_STEPS.map((step) => (
        <span
          key={step.key}
          className={row[step.key] ? 'import-sea-ops__on' : 'import-sea-ops__off'}
        >
          {step.label}
        </span>
      ))}
      {CLEARANCE_STEPS.map((step) => (
        <Tooltip key={step.label}>
          <TooltipTrigger
            render={
              <span className={pillClass(step.state(row))}>{step.label}</span>
            }
          />
          <TooltipContent>{step.tooltip}</TooltipContent>
        </Tooltip>
      ))}
      <span className={row.truck_booked ? 'import-sea-ops__on' : 'import-sea-ops__off'}>
        TRK
      </span>
    </span>
  )
}
