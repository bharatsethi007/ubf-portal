import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '../../supabase'
import { quoteStatusPill } from '../quotes/quotesTableColumns'
import { fmtHours, modeOf } from './agentStatsApi'

type Line = { description: string | null; charge_group: string | null; qty: number | null; unit: string | null; sell_rate: number | null; sell_currency: string | null; total_sell: number | null; ord: number | null }
type Resp = { id: string; response_no: string | null; status: string | null; carrier: string | null; currency: string | null; total_sell: number | null; margin_pct: number | null; transit_time_days: string | null; valid_till: string | null; created_at: string; quote_response_lines: Line[] }
type Quote = {
  id: string; quote_no: string | null; status: string; customer_name: string | null; agent_name: string | null
  shipment_mode: string | null; shipment_type: string | null; movement_type: string | null; incoterms: string | null; service_type: string | null
  from_port_code: string | null; to_port_code: string | null; created_at: string; won_at: string | null; expires_at: string | null
  quote_responses: Resp[]
}

const GROUP_ORDER = ['freight', 'origin', 'dest']
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const money = (v: number | null | undefined, c?: string | null) => (v == null ? '—' : `${c ?? ''} ${Number(v).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim())

/** Quick look at a quote: key facts and the latest response's charges, with a link to the full quote. */
export default function QuotePeekDialog({ quoteId, onClose }: { quoteId: string | null; onClose: () => void }) {
  const navigate = useNavigate()
  const [q, setQ] = useState<Quote | null>(null)

  useEffect(() => {
    if (!quoteId) { setQ(null); return }
    supabase.from('quotes')
      .select('id, quote_no, status, customer_name, agent_name, shipment_mode, shipment_type, movement_type, incoterms, service_type, from_port_code, to_port_code, created_at, won_at, expires_at, quote_responses(id, response_no, status, carrier, currency, total_sell, margin_pct, transit_time_days, valid_till, created_at, quote_response_lines(description, charge_group, qty, unit, sell_rate, sell_currency, total_sell, ord))')
      .eq('id', quoteId).maybeSingle()
      .then(({ data }) => setQ((data as Quote) ?? null))
  }, [quoteId])

  const resp = q?.quote_responses?.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  const lines = (resp?.quote_response_lines ?? []).slice().sort((a, b) =>
    (GROUP_ORDER.indexOf(a.charge_group ?? '') + 9) % 9 - (GROUP_ORDER.indexOf(b.charge_group ?? '') + 9) % 9 || (a.ord ?? 0) - (b.ord ?? 0))
  const ttw = q?.won_at ? (new Date(q.won_at).getTime() - new Date(q.created_at).getTime()) / 3600000 : null

  return (
    <Dialog open={!!quoteId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {!q ? <p className="m-0 py-8 text-center text-[13px] text-[#5B6474]">Loading quote…</p> : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2.5"><span className="font-mono">{q.quote_no}</span>{quoteStatusPill(q.status)}</DialogTitle>
              <div className="flex flex-wrap gap-3 text-[12.5px] text-[#5B6474]">
                <span>{q.agent_name ?? q.customer_name}</span>
                <span>{modeOf(q.shipment_mode, q.shipment_type)}{q.movement_type ? ` · ${q.movement_type}` : ''}</span>
                <span className="font-mono">{q.from_port_code ?? '?'} &gt; {q.to_port_code ?? '?'}</span>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-[10px] border border-[#E6E8EE] p-4 sm:grid-cols-4 text-[13px]">
              {[['Incoterm', q.incoterms], ['Service', q.service_type], ['Created', day(q.created_at)], [q.won_at ? 'Won' : 'Expires', day(q.won_at ?? q.expires_at)],
                ['Carrier', resp?.carrier], ['Transit', resp?.transit_time_days ? `${resp.transit_time_days} days` : null], ['Valid till', day(resp?.valid_till ?? null)], ['Time to win', ttw == null ? null : fmtHours(ttw)]]
                .map(([k, v]) => (
                  <div key={k as string} className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[11px] uppercase tracking-[0.04em] text-[#5B6474]">{k}</span>
                    <span className="truncate">{v || '—'}</span>
                  </div>
                ))}
            </div>

            {resp ? (
              <div className="overflow-hidden rounded-[10px] border border-[#E6E8EE]">
                <div className="flex items-center justify-between bg-[#F7F8FA] px-4 py-2 text-[12px] text-[#5B6474]">
                  <span>Response {resp.response_no ?? ''} · {q.quote_responses.length} total</span>
                  <span>{resp.margin_pct != null ? `${Math.round(Number(resp.margin_pct))}% margin` : ''}</span>
                </div>
                <div className="max-h-[260px] overflow-y-auto">
                  {lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-[70px_minmax(0,1fr)_110px] gap-3 border-t border-[#F0F1F4] px-4 py-2 text-[12.5px]">
                      <span className="capitalize text-[#5B6474]">{l.charge_group ?? ''}</span>
                      <span className="truncate">{l.description ?? '—'}</span>
                      <span className="text-right tabular-nums">{money(l.total_sell ?? (l.sell_rate != null ? l.sell_rate * Number(l.qty ?? 1) : null), l.sell_currency)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-[#E6E8EE] px-4 py-2.5 text-[13px]">
                  <span>Total sell</span><span className="tabular-nums">{money(resp.total_sell, resp.currency)}</span>
                </div>
              </div>
            ) : <p className="m-0 rounded-[10px] bg-[#F7F8FA] px-4 py-3 text-[12.5px] text-[#5B6474]">Not priced yet.</p>}

            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn--inline" onClick={onClose}>Close</button>
              <button type="button" className="btn quotes-page__new-btn" onClick={() => navigate(`/quotes/${q.id}`)}><ExternalLink size={14} /> View full details</button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
