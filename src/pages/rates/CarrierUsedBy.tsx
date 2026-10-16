import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useStaffList } from '../../hooks/useStaffList'
import { RateCardPill } from '../quotes/rateCards/RateCardPill'
import { GP_FLOOR, fmtDate, viewStatus, type CardStatus } from '../quotes/rateCards/rateCardModel'

type Row = { card_id: string; ref: string; version: number; account_id: string; customer: string; status: CardStatus; valid_from: string; valid_to: string; lanes: number; gp_today: number | null; pricing_id: string | null }

/** Setup carrier card: customer rate cards priced from it. Shown before anyone changes or lets it lapse. */
export default function CarrierUsedBy({ cardId, validTo }: { cardId: string; validTo?: string | null }) {
  const { staff } = useStaffList()
  const staffMap = useMemo(() => new Map(staff.map((s) => [s.user_id, s.name])), [staff])
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    supabase.rpc('carrier_card_used_by', { p_card: cardId }).then(({ data, error }) => setRows(error ? [] : ((data ?? []) as Row[])))
  }, [cardId])

  if (!rows || rows.length === 0) return null
  const live = rows.filter((r) => r.status === 'live')
  const endsFirst = validTo ? live.filter((r) => r.valid_to > validTo) : []

  return (
    <>
      <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid var(--border, rgba(0,0,0,.08))' }} />
      <section className="flex flex-col gap-3">
        <h2 style={{ fontSize: 16, margin: 0 }}>Used by customer rate cards <span className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 400 }}>({rows.length})</span></h2>
        {endsFirst.length > 0 && (
          <div className="rounded-lg bg-[#FFFAEB] px-3.5 py-2.5 text-[12.5px] text-[#B54708]">
            This card ends {fmtDate(validTo)}. {endsFirst.length} live customer rate card{endsFirst.length > 1 ? 's run' : ' runs'} past it. Reprice or load the next carrier rates.
          </div>
        )}
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Rate card</th><th>Customer</th><th>Status</th><th style={{ textAlign: 'right' }}>Lanes from here</th><th>Valid to</th><th style={{ textAlign: 'right' }}>GP at today's buy</th><th>Pricing</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.card_id}>
                  <td><Link to={`/quotes/rate-cards/${r.card_id}`} className="font-mono text-[12px]">{r.ref}</Link>{r.version > 1 && <span className="ml-1 text-[11px] text-[#5B6474]">v{r.version}</span>}</td>
                  <td><Link to={`/customers/${r.account_id}?tab=rates`}>{r.customer}</Link></td>
                  <td><RateCardPill status={viewStatus(r)} /></td>
                  <td style={{ textAlign: 'right' }}>{r.lanes}</td>
                  <td>{fmtDate(r.valid_to)}</td>
                  <td style={{ textAlign: 'right', color: r.gp_today == null ? undefined : r.gp_today < GP_FLOOR ? '#B42318' : '#067647' }}>{r.gp_today == null ? '–' : `${r.gp_today}%`}</td>
                  <td>{staffMap.get(r.pricing_id ?? '') ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
