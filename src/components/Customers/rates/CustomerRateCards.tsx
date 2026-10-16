import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { FileDown, Plus } from 'lucide-react'
import { supabase } from '@/supabase'
import { usePerm } from '@/access/PermissionsProvider'
import { usePorts } from '@/hooks/usePorts'
import { useStaffList } from '@/hooks/useStaffList'
import NewRateCardDialog from '@/pages/quotes/rateCards/NewRateCardDialog'
import { RateCardPill } from '@/pages/quotes/rateCards/RateCardPill'
import { fmtDate, getCard, viewStatus, type RateCard } from '@/pages/quotes/rateCards/rateCardsApi'

type Row = Pick<RateCard, 'id' | 'ref' | 'version' | 'title' | 'status' | 'valid_from' | 'valid_to' | 'published_at'> & { lanes: number }

/** Customer record > Rates: the customer's rate cards, live and upcoming first. */
export default function CustomerRateCards({ accountId, name }: { accountId: string; name: string }) {
  const canAdd = usePerm('customer_rates', 'add')
  const { staff } = useStaffList()
  const { ports } = usePorts()
  const [rows, setRows] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('customer_rate_cards')
      .select('id, ref, version, title, status, valid_from, valid_to, published_at, customer_rate_card_lines(count)')
      .eq('account_id', accountId).neq('status', 'void').order('valid_from', { ascending: false }).limit(50)
      .then(({ data }) => setRows(((data ?? []) as (Row & { customer_rate_card_lines: { count: number }[] })[])
        .map((r) => ({ ...r, lanes: r.customer_rate_card_lines?.[0]?.count ?? 0 }))))
  }, [accountId])

  const withView = useMemo(() => rows.map((r) => ({ ...r, view: viewStatus(r) })), [rows])
  const current = withView.find((r) => r.view === 'live' || r.view === 'expiring')
  const next = withView.filter((r) => ['scheduled', 'pending', 'draft', 'changes'].includes(r.view)).sort((a, b) => a.valid_from.localeCompare(b.valid_from))[0]

  async function pdf(id: string) {
    setBusy(true)
    try {
      const { card, lines } = await getCard(id)
      const m = await import('@/pages/quotes/rateCards/RateCardPdf')
      await m.downloadRateCardPdf(card, lines, { portName: (c) => ports.get(c)?.name ?? c, staffName: (u) => staff.find((s) => s.user_id === u)?.name ?? '' })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'PDF failed') } finally { setBusy(false) }
  }

  const tile = 'flex min-w-0 flex-col gap-1.5 px-[18px] py-4'
  return (
    <section className="cp-card">
      <div className="cp-card-head"><h3 className="cp-card-title">Rate cards</h3><span className="text-muted-foreground">Live rate cards are this customer's contract rates</span></div>
      <div className="grid border-b border-[#F0F1F4] md:grid-cols-3">
        <div className={`${tile} md:border-r md:border-[#F0F1F4]`}>
          <span className="text-[11.5px] text-[#5B6474]">Live now</span>
          {current ? (<>
            <Link to={`/quotes/rate-cards/${current.id}`} className="font-mono text-[13px]">{current.ref}{current.title ? ` · ${current.title}` : ''}</Link>
            <span className="text-[12.5px] text-[#334155]">{current.lanes} lanes · {fmtDate(current.valid_from)} to {fmtDate(current.valid_to)}</span>
            <span><RateCardPill status={current.view} /></span>
          </>) : <span className="text-[12.5px] text-[#5B6474]">No live rate card</span>}
        </div>
        <div className={`${tile} md:border-r md:border-[#F0F1F4]`}>
          <span className="text-[11.5px] text-[#5B6474]">Next</span>
          {next ? (<>
            <Link to={`/quotes/rate-cards/${next.id}`} className="font-mono text-[13px]">{next.ref}{next.title ? ` · ${next.title}` : ''}</Link>
            <span className="text-[12.5px] text-[#334155]">{next.lanes} lanes · from {fmtDate(next.valid_from)}</span>
            <span><RateCardPill status={next.view} /></span>
          </>) : <span className="text-[12.5px] text-[#5B6474]">Nothing in progress</span>}
        </div>
        <div className={`${tile} justify-center`}>
          {canAdd && <button type="button" className="btn quotes-page__new-btn w-fit" onClick={() => setOpen(true)}><Plus size={14} /> New rate card for {name}</button>}
          {current && <button type="button" className="btn btn--inline w-fit" disabled={busy} onClick={() => void pdf(current.id)}><FileDown size={14} /> Download live PDF</button>}
        </div>
      </div>
      {withView.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Ref</th><th>Title</th><th style={{ textAlign: 'right' }}>Lanes</th><th>Validity</th><th>Status</th></tr></thead>
            <tbody>
              {withView.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/quotes/rate-cards/${r.id}`} className="font-mono text-[12px]">{r.ref}</Link>{r.version > 1 && <span className="ml-1 text-[11px] text-[#5B6474]">v{r.version}</span>}</td>
                  <td>{r.title || '–'}</td>
                  <td style={{ textAlign: 'right' }}>{r.lanes}</td>
                  <td className="whitespace-nowrap">{fmtDate(r.valid_from)} to {fmtDate(r.valid_to)}</td>
                  <td><RateCardPill status={r.view} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NewRateCardDialog open={open} onOpenChange={setOpen} account={{ id: accountId, name }} />
    </section>
  )
}
