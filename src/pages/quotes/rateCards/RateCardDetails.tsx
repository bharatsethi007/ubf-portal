import type { StaffOption } from '../../../hooks/useStaffList'
import type { RateCard } from './rateCardModel'
import type { CardPatch } from './rateCardsApi'

type Props = { card: RateCard; editable: boolean; staff: StaffOption[]; onChange: (p: CardPatch) => void }

const lbl = 'text-[11.5px] text-[#5B6474]'
const PRES: { key: RateCard['presentation']; label: string }[] = [{ key: 'freight', label: 'Freight only' }, { key: 'all_in', label: 'All-in' }, { key: 'breakdown', label: 'Breakdown' }, { key: 'both', label: 'Both' }]

/** Card header fields: title, dates, owners, presentation, FX and terms. */
export default function RateCardDetails({ card: c, editable, staff, onChange }: Props) {
  const fxEntries = Object.entries(c.fx ?? {}).filter(([k]) => ['NZD', 'AUD', 'FJD', 'USD'].includes(k))
  return (
    <>
      <section className="cp-card">
        <div className="cp-card-head"><h3 className="cp-card-title">Details</h3></div>
        <div className="grid grid-cols-2 gap-3.5 px-[18px] pb-4 lg:grid-cols-4">
          <label className="col-span-2 flex flex-col gap-1"><span className={lbl}>Title (on the PDF)</span>
            <input className="input" disabled={!editable} value={c.title} placeholder="e.g. Asia import FCL and LCL" onChange={(e) => onChange({ title: e.target.value })} /></label>
          <label className="flex flex-col gap-1"><span className={lbl}>Valid from</span>
            <input type="date" className="input" disabled={!editable} value={c.valid_from} onChange={(e) => onChange({ valid_from: e.target.value })} /></label>
          <label className="flex flex-col gap-1"><span className={lbl}>Valid to</span>
            <input type="date" className="input" disabled={!editable} value={c.valid_to} min={c.valid_from} onChange={(e) => onChange({ valid_to: e.target.value })} /></label>
          <label className="flex flex-col gap-1"><span className={lbl}>Sales</span>
            <select className="input" disabled={!editable} value={c.sales_id ?? ''} onChange={(e) => onChange({ sales_id: e.target.value || null })}>
              <option value="">–</option>{staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}</select></label>
          <label className="flex flex-col gap-1"><span className={lbl}>Pricing</span>
            <select className="input" disabled={!editable} value={c.pricing_id ?? ''} onChange={(e) => onChange({ pricing_id: e.target.value || null })}>
              <option value="">–</option>{staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}</select></label>
          <div className="flex flex-col gap-1"><span className={lbl}>Show on PDF and portal</span>
            <div className="inline-flex w-fit gap-0.5 rounded-lg bg-[#F1F3F7] p-[3px]" role="group" aria-label="Presentation">
              {PRES.map((p) => (
                <button key={p.key} type="button" disabled={!editable} onClick={() => onChange({ presentation: p.key })}
                  className={`h-7 rounded-md px-3 text-[12px] ${c.presentation === p.key ? 'bg-white text-[#0A2472] shadow-sm' : 'text-[#5B6474]'}`}>{p.label}</button>
              ))}
            </div></div>
          <div className="flex flex-col gap-1"><span className={lbl}>FX for all-in (per 1 unit)</span>
            <div className="flex flex-wrap gap-2">
              {fxEntries.filter(([k]) => k !== 'USD').map(([k, v]) => (
                <label key={k} className="inline-flex items-center gap-1 text-[12px]">{k}
                  <input className="h-7 w-[72px] rounded-md border border-[#E6E8EE] px-2 text-right text-[12px]" disabled={!editable} value={v}
                    onChange={(e) => onChange({ fx: { ...c.fx, [k]: Number(e.target.value) || 0 } })} /></label>
              ))}
              {!fxEntries.length && <span className="text-[12px] text-[#5B6474]">No FX loaded</span>}
            </div></div>
        </div>
      </section>

      <section className="cp-card">
        <div className="cp-card-head"><h3 className="cp-card-title">Terms on the rate card</h3><span className="text-muted-foreground">Prefilled, edit per card</span></div>
        <div className="grid gap-3.5 px-[18px] pb-4 lg:grid-cols-3">
          {(['included', 'excluded', 'terms'] as const).map((k) => (
            <label key={k} className="flex flex-col gap-1"><span className={lbl}>{k === 'included' ? 'Included' : k === 'excluded' ? 'Not included' : 'Terms'}</span>
              <textarea className="input" disabled={!editable} rows={5} style={{ height: 112, resize: 'vertical', paddingTop: 8, lineHeight: '18px' }}
                value={c[k] ?? ''} onChange={(e) => onChange({ [k]: e.target.value } as CardPatch)} /></label>
          ))}
        </div>
      </section>
    </>
  )
}
