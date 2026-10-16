import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ShipmentRow } from './customerProfileApi'
import { StatusPill, ModeIcon, Lane, fmt } from './profileUi'

const MODULE_LABEL: Record<string, string> = { FEA: 'Export air', FES: 'Export sea', FIA: 'Import air', FIS: 'Import sea' }

function Item({ k, v, mono }: { k: string; v: string | number | null | undefined; mono?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-[0.04em] text-[#5B6474]">{k}</span>
      <span className={`truncate text-[13px] text-[#0F172A] ${mono ? 'font-mono text-[12.5px]' : ''}`} title={v == null ? '' : String(v)}>{v == null || v === '' ? '—' : v}</span>
    </div>
  )
}

/** Quick look at a shipment row, with a link to the full shipment page. */
export default function ShipmentPeekDialog({ row, onClose }: { row: ShipmentRow | null; onClose: () => void }) {
  const navigate = useNavigate()
  if (!row) return null
  const r = row
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono">{r.house_bill ?? `Job ${r.job_unique}`}</span>
            <StatusPill status={r.status} />
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-[#5B6474]">
            <ModeIcon mode={r.mode} />
            <span>{MODULE_LABEL[r.module ?? ''] ?? r.module ?? ''}{r.mode === 'sea' && r.load_type ? ` · ${r.load_type}` : ''}</span>
            <Lane origin={r.origin} destination={r.destination} />
            {r.final_dest && r.final_dest !== r.destination && <span>Final {r.final_dest}</span>}
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 rounded-[10px] border border-[#E6E8EE] p-4 sm:grid-cols-3">
          <Item k="ETD" v={fmt.date(r.etd)} />
          <Item k="ETA" v={fmt.date(r.eta)} />
          <Item k="Vessel / flight" v={r.vessel_flight} />
          <Item k="Master bill" v={r.master_bill} mono />
          <Item k="Job" v={r.job_unique} mono />
          <Item k="Consol" v={r.consol_key} mono />
          <Item k="Shipper" v={r.shipper_name} />
          <Item k="Billing party" v={r.billing_party ?? r.customer_account_id} />
          <Item k="Packages" v={r.pack_qty ? `${fmt.int(r.pack_qty)} ${r.pack_type ?? ''}`.trim() : null} />
          <Item k="Weight" v={r.weight_kg ? `${fmt.int(r.weight_kg)} kg` : null} />
          <Item k="Volume" v={r.volume_m3 ? `${fmt.num(r.volume_m3)} m³` : null} />
          <Item k="Relevant date" v={fmt.date(r.relevant_date)} />
        </div>
        {r.goods_desc && (
          <div className="rounded-[10px] bg-[#F7F8FA] px-4 py-3 text-[12.5px] leading-[19px] text-[#334155]">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.04em] text-[#5B6474]">Goods</span>
            {r.goods_desc}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn--inline" onClick={onClose}>Close</button>
          <button type="button" className="btn quotes-page__new-btn" onClick={() => navigate(`/shipments/${r.job_unique}`)}>
            <ExternalLink size={14} /> View full details
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
