import CargoHandling from '../../../components/bookings/CargoHandling'
import CargoLinesTable from '../../../components/bookings/CargoLinesTable'
import type { CargoLineRow } from '../../../types/bookingCargoLine'
import { SectionCard, type SectionProps } from '../formUi'

type Props = SectionProps & {
  cargoLines: CargoLineRow[]
  onCargoLinesChange: (lines: CargoLineRow[]) => void
}

export default function CargoSection({ state, set, cargoLines, onCargoLinesChange }: Props) {
  return (
    <SectionCard id="cargo" title="Cargo details">
      <CargoLinesTable lines={cargoLines} onChange={onCargoLinesChange} />
      <CargoHandling state={state} set={set} />
    </SectionCard>
  )
}
