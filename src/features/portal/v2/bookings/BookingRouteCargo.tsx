import type { ReactNode } from 'react'
import { Plane, Ship } from 'lucide-react'
import DateField from '../../../../components/DateField'
import { usePorts } from '../../../../hooks/usePorts'
import PortPicker from './PortPicker'
import { CONTAINER_TYPES, INCOTERMS, PACKING } from './bookingsApi'
import { INCOTERM_HELP, type BookingDraft } from './bookingModel'

type Set = <K extends keyof BookingDraft>(k: K, v: BookingDraft[K]) => void
type Props = { f: BookingDraft; set: Set; setMode: (m: 'sea' | 'air') => void; laneLocked: boolean }

function Seg<T extends string>({ value, options, onChange, label, disabled }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void; label: string; disabled?: boolean }) {
  return (
    <div className="pv3-seg pv3-seg--form" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" disabled={disabled} className={value === o.v ? 'pv3-seg__on' : ''} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  )
}

/** Route, terms and cargo. With a quote the lane is fixed by the quote. */
export default function BookingRouteCargo({ f, set, setMode, laneLocked }: Props) {
  const { ports } = usePorts()
  const fcl = f.mode === 'sea' && f.load_type === 'FCL'
  return (
    <>
      <section className="pv3-card pv3-form pv3-rise" style={{ animationDelay: '.05s' }}>
        <h2>Route and terms</h2>
        {!laneLocked && (
          <>
            <div className="pv3-form__row">
              <div className="pv3-field"><label>Direction</label>
                <Seg label="Direction" value={f.direction} onChange={(v) => set('direction', v)} options={[{ v: 'import', label: 'Import to NZ' }, { v: 'export', label: 'Export from NZ' }]} />
              </div>
              <div className="pv3-field"><label>Mode</label>
                <Seg label="Mode" value={f.mode} onChange={setMode} options={[{ v: 'sea', label: <><Ship size={14} /> Sea</> }, { v: 'air', label: <><Plane size={14} /> Air</> }]} />
              </div>
              {f.mode === 'sea' && (
                <div className="pv3-field"><label>Load</label>
                  <Seg label="Load" value={f.load_type as 'FCL' | 'LCL'} onChange={(v) => set('load_type', v)} options={[{ v: 'FCL', label: 'Full container' }, { v: 'LCL', label: 'Shared (LCL)' }]} />
                </div>
              )}
            </div>
            <div className="pv3-form__grid">
              <PortPicker id="bk-origin" label="From" value={f.origin} onChange={(v) => set('origin', v)} ports={ports} mode={f.mode} />
              <PortPicker id="bk-dest" label="To" value={f.destination} onChange={(v) => set('destination', v)} ports={ports} mode={f.mode} />
            </div>
          </>
        )}
        <div className="pv3-form__grid">
          <div className="pv3-field"><label>Cargo ready</label><DateField value={f.cargo_ready_date || null} onChange={(v) => set('cargo_ready_date', v)} width="100%" placeholder="Select date" /></div>
          <div className="pv3-field"><label htmlFor="bk-inco">Incoterm</label>
            <select id="bk-inco" value={f.incoterm} onChange={(e) => set('incoterm', e.target.value)}>
              <option value="">Choose</option>
              {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>
        {f.incoterm && <p className="pv3-muted" style={{ margin: '-4px 0 0', fontSize: 12.5 }}>{f.incoterm}: {INCOTERM_HELP[f.incoterm]}</p>}
      </section>

      <section className="pv3-card pv3-form pv3-rise" style={{ animationDelay: '.1s' }}>
        <h2>Cargo</h2>
        <div className="pv3-field pv3-field--wide"><label htmlFor="bk-goods">What are you shipping?</label>
          <input id="bk-goods" value={f.goods_description} onChange={(e) => set('goods_description', e.target.value)} placeholder="e.g. Porcelain floor tiles" />
        </div>
        {fcl ? (
          <div className="pv3-form__grid">
            <div className="pv3-field"><label htmlFor="bk-ct">Container</label>
              <select id="bk-ct" value={f.container_type} onChange={(e) => set('container_type', e.target.value)}>
                {CONTAINER_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="pv3-field"><label htmlFor="bk-cc">How many</label>
              <input id="bk-cc" type="number" min={1} value={f.container_count} onChange={(e) => set('container_count', e.target.value)} />
            </div>
            <div className="pv3-field"><label htmlFor="bk-kg">Total weight (kg)</label>
              <input id="bk-kg" type="number" min={0} value={f.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} placeholder="Approximate is fine" />
            </div>
            <div className="pv3-field"><label htmlFor="bk-hs">HS code</label>
              <input id="bk-hs" value={f.hs_code} onChange={(e) => set('hs_code', e.target.value)} placeholder="Optional" />
            </div>
          </div>
        ) : (
          <div className="pv3-form__grid">
            <div className="pv3-field"><label htmlFor="bk-pcs">Pieces</label>
              <input id="bk-pcs" type="number" min={1} value={f.pieces} onChange={(e) => set('pieces', e.target.value)} />
            </div>
            <div className="pv3-field"><label htmlFor="bk-pk">Packed as</label>
              <select id="bk-pk" value={f.packing_type} onChange={(e) => set('packing_type', e.target.value)}>
                <option value="">Choose</option>
                {PACKING.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="pv3-field"><label htmlFor="bk-kg2">Total weight (kg)</label>
              <input id="bk-kg2" type="number" min={0} value={f.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} />
            </div>
            <div className="pv3-field"><label htmlFor="bk-cbm">Volume (m³)</label>
              <input id="bk-cbm" type="number" min={0} step="0.01" value={f.cbm} onChange={(e) => set('cbm', e.target.value)} />
            </div>
            <div className="pv3-field"><label htmlFor="bk-hs">HS code</label>
              <input id="bk-hs" value={f.hs_code} onChange={(e) => set('hs_code', e.target.value)} placeholder="Optional" />
            </div>
          </div>
        )}
        <div className="pv3-form__checks">
          <label className="pv3-check"><input type="checkbox" checked={f.is_dg} onChange={(e) => set('is_dg', e.target.checked)} /> Dangerous goods</label>
          <label className="pv3-check"><input type="checkbox" checked={f.is_temp_controlled} onChange={(e) => set('is_temp_controlled', e.target.checked)} /> Temperature controlled</label>
        </div>
        {(f.is_dg || f.is_temp_controlled) && (
          <div className="pv3-form__grid">
            {f.is_dg && <div className="pv3-field"><label htmlFor="bk-un">UN number</label><input id="bk-un" value={f.un_number} onChange={(e) => set('un_number', e.target.value)} placeholder="UN1263" /></div>}
            {f.is_dg && <div className="pv3-field"><label htmlFor="bk-cls">Class</label><input id="bk-cls" value={f.dg_class} onChange={(e) => set('dg_class', e.target.value)} placeholder="3" /></div>}
            {f.is_temp_controlled && <div className="pv3-field"><label htmlFor="bk-tmp">Temperature</label><input id="bk-tmp" value={f.temp_range} onChange={(e) => set('temp_range', e.target.value)} placeholder="e.g. 2 to 8 °C" /></div>}
          </div>
        )}
      </section>
    </>
  )
}
