import { Card } from './eaUi'
import type { EaDetail } from './useEaBooking'

/** Mirrors the fields the Consolidation2 XML needs. Green = nothing to do. */
export function exportChecks(b: EaDetail) {
  return [
    { label: b.shipper_account_id ? `Shipper code ${b.shipper_account_id}` : 'Shipper code missing', ok: !!b.shipper_account_id },
    { label: b.consignee_account_id ? `Consignee code ${b.consignee_account_id}` : 'Consignee code missing', ok: !!b.consignee_account_id },
    { label: b.bill_to_account_id ? `Bill-to ${b.bill_to_account_id}` : 'Bill-to missing', ok: !!b.bill_to_account_id },
    { label: 'Actual weights from check-in', ok: b.act_kg != null || !!b.wms_checkin_at },
    { label: 'Goods description', ok: !!(b.goods_description ?? b.commodity)?.trim() },
    { label: 'Value and currency', ok: b.cargo_value != null },
    { label: b.consol_flight ? `Allocated to ${b.consol_flight}` : 'Allocated to consol', ok: !!b.consol_id },
  ]
}

export default function EaExportCard({ b }: { b: EaDetail }) {
  const checks = exportChecks(b)
  const ready = checks.filter((c) => c.ok).length
  const exported = b.stage >= 5
  return (
    <Card
      title="TradeWindow export"
      aside={
        <span className="text-[11.5px] text-[#5B616E]">
          {exported
            ? <>Exported{b.consol_mawb ? <> on MAWB <span className="bk-mono text-[#14161A]">{b.consol_mawb}</span></> : null} · locked</>
            : <><b className="font-semibold text-[#14161A]">{ready} of {checks.length}</b> ready · sent with consol at close · HAWB issued by TW</>}
        </span>
      }
    >
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-4 gap-y-2 px-4 pb-3.5 pt-3">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-[12px]">
            <span
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 rounded-full"
              style={c.ok ? { background: '#17B26A', boxShadow: 'inset 0 0 0 4px #ECFDF3' } : { border: '1.5px dashed #F79009' }}
            />
            <span className={c.ok ? 'text-[#14161A]' : 'font-medium text-[#B54708]'}>{c.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
