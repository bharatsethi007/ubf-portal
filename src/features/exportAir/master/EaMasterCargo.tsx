import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { cargoOf, fmtNum, type EaRow } from '../eaTypes'
import { Card, Tag } from '../eaUi'
import { cleanForTw } from '../EaCargoCard'
import { masterTotals, subIssues, supplierOf } from '../eaMaster'
import type { EaDetail } from '../useEaBooking'

type Props = { b: EaDetail; subs: EaRow[]; onTab: (id: string) => void }

/** Master cargo: one line per supplier, totals at the bottom. Totals are what TradeWindow receives. */
export default function EaMasterCargo({ b, subs, onTab }: Props) {
  const t = masterTotals(subs)
  const goods = cleanForTw(b.goods_description || [...new Set(subs.map((s) => (s as unknown as EaDetail).goods_description).filter(Boolean))].join(', '))
  const th = 'px-3 py-2 text-left text-[10.5px] font-medium uppercase tracking-[.04em] text-[#6B7280]'
  return (
    <Card title="Cargo · all suppliers" aside={<span className="text-[11.5px] text-[#6B7280]">Exports to TradeWindow as one house</span>}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-[#F1F2F5]">
              <th className={th}>Supplier</th><th className={th}>HAWB</th>
              <th className={`${th} !text-right`}>Pcs</th><th className={`${th} !text-right`}>Kg</th><th className={`${th} !text-right`}>m³</th>
              <th className={`${th} !text-right`}>Chg</th><th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => {
              const c = cargoOf(s)
              const issues = subIssues(s)
              const measured = s.act_pcs != null
              return (
                <tr key={s.id} onClick={() => onTab(s.id)} className="cursor-pointer border-b border-[#F6F7F9] hover:bg-[#F8F9FB]">
                  <td className="max-w-[220px] truncate px-3 py-2 font-medium text-[#14161A]">{supplierOf(s)}</td>
                  <td className="bk-mono px-3 py-2 text-[12px] text-[#0A2472]">{s.booking_ref}</td>
                  <td className="bk-mono px-3 py-2 text-right">{fmtNum(c.pcs)}</td>
                  <td className="bk-mono px-3 py-2 text-right">{fmtNum(c.kg, 1)}</td>
                  <td className="bk-mono px-3 py-2 text-right">{fmtNum(c.cbm, 3)}</td>
                  <td className="bk-mono px-3 py-2 text-right">{fmtNum(c.chg)}</td>
                  <td className="px-3 py-2">
                    {issues.length
                      ? <span className="inline-flex items-center gap-1 text-[12px] text-[#B54708]" title={issues.join('\n')}><AlertCircle size={13} /> {issues[0]}{issues.length > 1 ? ` +${issues.length - 1}` : ''}</span>
                      : <span className="inline-flex items-center gap-1 text-[12px] text-[#067647]"><CheckCircle2 size={13} /> Complete</span>}
                    {measured ? <span className="ml-1.5"><Tag tone="navy">Measured</Tag></span> : null}
                  </td>
                </tr>
              )
            })}
            {!subs.length ? <tr><td colSpan={7} className="px-3 py-4 text-[12px] text-[#6B7280]">No sub-HAWBs yet. Use Add HAWB above.</td></tr> : null}
          </tbody>
          <tfoot>
            <tr className="bg-[#FAFBFC]">
              <td className="px-3 py-2.5 font-semibold" colSpan={2}>Main total · {subs.length} supplier{subs.length === 1 ? '' : 's'}</td>
              <td className="bk-mono px-3 py-2.5 text-right font-semibold">{fmtNum(t.pcs)}</td>
              <td className="bk-mono px-3 py-2.5 text-right font-semibold">{fmtNum(t.kg, 1)}</td>
              <td className="bk-mono px-3 py-2.5 text-right font-semibold">{fmtNum(t.cbm, 3)}</td>
              <td className="bk-mono px-3 py-2.5 text-right font-semibold">{fmtNum(t.chg)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-col gap-1 border-t border-[#F1F2F5] px-4 py-3">
        <span className="text-[10.5px] uppercase tracking-[.04em] text-[#6B7280]">Goods description (TradeWindow)</span>
        <span className="text-[12.5px] text-[#14161A]">{goods || <span className="text-[#B54708]">Missing. Add goods on each sub-HAWB or edit the main HAWB.</span>}</span>
      </div>
    </Card>
  )
}
