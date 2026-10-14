import { DG_CLASS_OPTIONS } from '../quoteDgClasses'
import { Chip, Field, inp, lbl } from './qdUi'
import type { Cargo } from './useQuoteDetail'

const CURRENCIES = ['NZD', 'USD', 'AUD', 'EUR', 'GBP', 'CNY', 'FJD', 'SGD']
const num = (v: string) => (v === '' ? null : Number(v))

/** Declared value plus handling flags, as the bottom band of the Shipment card. */
export function CargoSection({ cargo: c, patch }: { cargo: Cargo; patch: (p: Partial<Cargo>) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 border-t border-[#F1F2F5] px-4 py-3.5 md:grid-cols-[minmax(240px,1fr)_2fr]">
      <div className="grid grid-cols-[96px_1fr] gap-2">
        <Field label="Currency">
          <select className={inp} value={c.cargo_value_currency ?? 'NZD'} onChange={(e) => patch({ cargo_value_currency: e.target.value })}>
            {CURRENCIES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Cargo value">
          <input className={`${inp} bk-mono text-right`} type="number" placeholder="—" value={c.cargo_value ?? ''}
            onChange={(e) => patch({ cargo_value: num(e.target.value) })} />
        </Field>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <span className={lbl}>Handling</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip on={c.need_insurance} onClick={() => patch({ need_insurance: !c.need_insurance })}>Insurance</Chip>
          <Chip on={c.need_refrigeration} onClick={() => patch({ need_refrigeration: !c.need_refrigeration, reefer_temp_c: c.need_refrigeration ? null : c.reefer_temp_c })}>Reefer</Chip>
          <Chip on={c.is_hazardous} onClick={() => patch({ is_hazardous: !c.is_hazardous, ...(c.is_hazardous ? { dg_un_number: null, dg_class: null } : {}) })}>Dangerous goods</Chip>
          <Chip on={c.stackable} onClick={() => patch({ stackable: !c.stackable })}>Stackable</Chip>
        </div>
        {c.need_refrigeration || c.is_hazardous ? (
          <div className="grid max-w-[520px] grid-cols-3 gap-2 rounded-lg bg-[#F8F9FB] p-2.5">
            {c.need_refrigeration ? (
              <Field label="Reefer temp °C">
                <input className={`${inp} bk-mono text-right`} type="number" value={c.reefer_temp_c ?? ''} onChange={(e) => patch({ reefer_temp_c: num(e.target.value) })} />
              </Field>
            ) : null}
            {c.is_hazardous ? (
              <>
                <Field label="UN number">
                  <input className={`${inp} bk-mono`} placeholder="UN1263" value={c.dg_un_number ?? ''} onChange={(e) => patch({ dg_un_number: e.target.value || null })} />
                </Field>
                <Field label="DG class">
                  <select className={inp} value={c.dg_class ?? ''} onChange={(e) => patch({ dg_class: e.target.value || null })}>
                    <option value="">—</option>{DG_CLASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
