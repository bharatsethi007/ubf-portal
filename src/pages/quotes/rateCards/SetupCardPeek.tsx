import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, FilePlus2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RateCardPill } from './RateCardPill'
import { fmtDate, money, type SharedCard } from './rateCardsApi'
import { getSetupCard, type SetupCard, type SetupLine } from './setupCardsApi'

type Props = { card: SharedCard & { view: string }; onClose: () => void; onConvert: (c: SharedCard) => void }

/** Setup carrier card shared with customers, shown in place over Quotes > Customer rates. */
export default function SetupCardPeek({ card, onClose, onConvert }: Props) {
  const [d, setD] = useState<{ card: SetupCard; lines: SetupLine[] } | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => { getSetupCard(card.id).then(setD).catch(() => setD({ card: card as unknown as SetupCard, lines: [] })) }, [card])

  const type = String(card.rate_type)
  const lines = (d?.lines ?? []).filter((l) => !q.trim() || `${l.origin} ${l.dest} ${l.container ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  const dp = type === 'fcl' ? 0 : 2
  const kv = 'flex flex-col gap-0.5'
  const k = 'text-[11.5px] text-[#5B6474]'

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex h-[88vh] max-w-[min(1300px,96vw)] flex-col gap-3 sm:max-w-[min(1300px,96vw)]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2.5">
            {card.title}<RateCardPill status={card.view} />
            <span className="inline-flex rounded bg-[#EEF1F8] px-1.5 text-[11px] font-normal text-[#0A2472]">{type.toUpperCase()}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3 rounded-lg border border-[#E6E8EE] px-4 py-3 text-[13px]">
          <div className={kv}><span className={k}>Shared with</span><span>{card.customers.join(', ')}</span></div>
          <div className={kv}><span className={k}>Carrier or co-loader</span><span>{card.vendor ?? '–'}</span></div>
          <div className={kv}><span className={k}>Validity</span><span>{fmtDate(card.valid_from)} to {fmtDate(card.valid_to)}</span></div>
          <div className={kv}><span className={k}>Currency</span><span>{d?.card.currency_code ?? '–'}</span></div>
          <div className={kv}><span className={k}>Lanes</span><span>{card.lanes}</span></div>
          <span className="flex-1" />
          <Link to={`/setup/rates/${type}/${card.id}`} className="btn btn--inline"><ExternalLink size={14} /> Edit in Setup</Link>
          <button type="button" className="btn quotes-page__new-btn" onClick={() => onConvert(card)}><FilePlus2 size={14} /> Make customer rate card</button>
        </div>
        <input className="h-8 w-[260px] rounded-md border border-[#E6E8EE] px-2 text-[12.5px]" placeholder="Filter port or container" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[#E6E8EE]">
          <table className="data-table">
            <thead className="sticky top-0 bg-white"><tr>
              <th>Origin</th><th>Destination</th>{type === 'fcl' && <th>Container</th>}
              <th style={{ textAlign: 'right' }}>Buy</th><th style={{ textAlign: 'right' }}>Sell</th><th style={{ textAlign: 'right' }}>Margin</th>
              {type !== 'fcl' && <th style={{ textAlign: 'right' }}>Min</th>}<th>Transit</th><th>Freq</th><th>Via</th>
            </tr></thead>
            <tbody>
              {!d ? <tr><td colSpan={10} className="text-muted-foreground pad-inline">Loading…</td></tr>
                : lines.length === 0 ? <tr><td colSpan={10} className="text-muted-foreground pad-inline">No lines.</td></tr>
                : lines.map((l) => {
                  const m = l.buy && l.sell ? Math.round(((l.sell - l.buy) / l.sell) * 1000) / 10 : null
                  return (
                    <tr key={l.id}>
                      <td className="font-mono text-[12px]">{l.origin}</td><td className="font-mono text-[12px]">{l.dest}</td>
                      {type === 'fcl' && <td>{l.container ?? '–'}</td>}
                      <td style={{ textAlign: 'right' }}>{money(l.buy, l.currency, dp)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>{money(l.sell, l.currency, dp)}</td>
                      <td style={{ textAlign: 'right', color: m != null && m < 10 ? '#B42318' : '#067647' }}>{m == null ? '–' : `${m}%`}</td>
                      {type !== 'fcl' && <td style={{ textAlign: 'right' }}>{money(l.sell_min ?? l.min, l.currency, 0)}</td>}
                      <td>{l.transit_days ? `${l.transit_days}d` : '–'}</td><td>{l.frequency ?? '–'}</td><td>{l.via ?? '–'}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
