import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  computeCargoLine, fetchCargoDescriptionSuggestions, newQuoteCargoLine, type QuoteCargoLine,
} from './quoteCargoApi'
import QuoteCargoLines from './QuoteCargoLines'
import CargoModeSwitchDialog from './CargoModeSwitchDialog'
import { cleanTotalLine, hasCargo, needsCleaning, sumLines, toIndividual, toTotal } from './cargoModeSwitch'
import './quoteCargoEntry.css'

export type CargoEntryMode = 'total' | 'individual'

type Props = {
  mode: 'air' | 'sea'
  entryMode: CargoEntryMode
  onEntryModeChange: (m: CargoEntryMode) => void
  lines: QuoteCargoLine[]
  onChange: (lines: QuoteCargoLine[]) => void
  onAddLine: () => void
}

function fmt(n: number, d = 1): string {
  if (!n) return '0'
  return n.toFixed(d)
}

export default function QuoteCargoEntry({
  mode, entryMode, onEntryModeChange, lines, onChange, onAddLine,
}: Props) {
  const [descOpts, setDescOpts] = useState<string[]>([])
  useEffect(() => { fetchCargoDescriptionSuggestions().then(setDescOpts).catch(() => {}) }, [])

  const [pending, setPending] = useState<CargoEntryMode | null>(null)
  const totalLine = lines[0] ?? newQuoteCargoLine(0)

  // Old quotes can hold leftover dimensions under typed totals; totals win in Total mode.
  useEffect(() => {
    if (entryMode === 'total' && (needsCleaning(lines[0]) || lines.length > 1)) {
      onChange(lines.length > 1 ? toTotal(lines, mode) : [cleanTotalLine(lines[0])])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryMode])

  function setTotalField(patch: Partial<QuoteCargoLine>) {
    onChange([cleanTotalLine({ ...totalLine, ...patch })])
  }

  function requestMode(m: CargoEntryMode) {
    if (m === entryMode) return
    if (!hasCargo(lines, mode)) { onEntryModeChange(m); return }
    setPending(m)
  }
  function confirmMode() {
    if (!pending) return
    onChange(pending === 'total' ? toTotal(lines, mode) : toIndividual(lines, mode))
    onEntryModeChange(pending)
    setPending(null)
  }

  const c = computeCargoLine(cleanTotalLine(totalLine), mode)
  const volumetric = c.totalCbm * 167

  return (
    <div className="qce">
      <CargoModeSwitchDialog target={pending} mode={mode}
        sums={pending === 'individual' ? sumLines([cleanTotalLine(totalLine)], mode) : sumLines(lines, mode)}
        onCancel={() => setPending(null)} onConfirm={confirmMode} />
      <datalist id="cargo-desc-suggest">{descOpts.map((d) => <option key={d} value={d} />)}</datalist>

      <div className="qce__toggle" role="tablist" aria-label="Cargo entry mode">
        <button
          type="button" role="tab" aria-selected={entryMode === 'total'}
          className={`qce__toggle-btn${entryMode === 'total' ? ' qce__toggle-btn--on' : ''}`}
          onClick={() => requestMode('total')}
        >Total</button>
        <button
          type="button" role="tab" aria-selected={entryMode === 'individual'}
          className={`qce__toggle-btn${entryMode === 'individual' ? ' qce__toggle-btn--on' : ''}`}
          onClick={() => requestMode('individual')}
        >Individual</button>
      </div>

      {entryMode === 'total' ? (
        <div className="qce__total">
          <div className="qce__total-grid">
            <label className="qce__field">
              <span className="qce__label">Pieces</span>
              <input className="nqd-input" inputMode="numeric" value={totalLine.quantity}
                onChange={(e) => setTotalField({ quantity: e.target.value })} />
            </label>
            <label className="qce__field">
              <span className="qce__label">Commodity</span>
              <input className="nqd-input" list="cargo-desc-suggest" value={totalLine.cargo_description}
                onChange={(e) => setTotalField({ cargo_description: e.target.value })} />
            </label>
            <label className="qce__field">
              <span className="qce__label">Gross weight</span>
              <input className="nqd-input" inputMode="decimal" value={totalLine.total_weight}
                onChange={(e) => setTotalField({ total_weight: e.target.value })} />
            </label>
            <label className="qce__field">
              <span className="qce__label">Unit</span>
              <select className="nqd-input" value={totalLine.weight_unit}
                onChange={(e) => setTotalField({ weight_unit: e.target.value })}>
                <option value="KG">KG</option>
                <option value="LB">LB</option>
              </select>
            </label>
            <label className="qce__field">
              <span className="qce__label">Total CBM</span>
              <input className="nqd-input" inputMode="decimal" value={totalLine.total_cbm}
                onChange={(e) => setTotalField({ total_cbm: e.target.value })} />
            </label>
          </div>

          <div className="qce__readout">
            <span>Gross <strong>{fmt(c.grossTotal)}</strong> kg</span>
            {mode === 'air' && <span>Volumetric <strong>{fmt(volumetric)}</strong> kg</span>}
            <span className="qce__readout--charge">
              {mode === 'air' ? 'Chargeable' : 'CBM'}{' '}
              <strong>{mode === 'air' ? fmt(c.chargeable) : fmt(c.totalCbm, 3)}</strong>
              {mode === 'air' ? ' kg' : ' m³'}
            </span>
          </div>
          {mode === 'air' && (
            <p className="qce__hint">Chargeable = greater of gross and volumetric (CBM × 167), rounded up to the next 0.5 kg.</p>
          )}
        </div>
      ) : (
        <>
          <QuoteCargoLines lines={lines} mode={mode} onChange={onChange} />
          <button className="nqd-addgrp" onClick={onAddLine}><Plus size={15} /> Add cargo line</button>
        </>
      )}
    </div>
  )
}
