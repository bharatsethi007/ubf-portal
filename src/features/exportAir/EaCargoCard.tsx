import { cargoOf, fmtNum } from './eaTypes'
import { Card, lbl, Tag } from './eaUi'
import type { CargoLine, EaDetail } from './useEaBooking'
import EaPieceLines from './EaPieceLines'

/** TradeWindow chokes on line breaks, smart quotes and stray symbols. Same rule the XML export uses. */
export function cleanForTw(s: string | null | undefined) {
  return (s ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[‘’“”'"`]/g, '')
    .replace(/&/g, ' AND ')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const sum = (ls: CargoLine[], k: 'pieces' | 'weight' | 'cbm') =>
  ls.length ? ls.reduce((a, l) => a + Number(l[k] ?? 0), 0) : null

export default function EaCargoCard({ b, lines }: { b: EaDetail; lines: CargoLine[] }) {
  const booked = lines.filter((l) => l.kind === 'booked')
  const bk = {
    pcs: b.pieces ?? sum(booked, 'pieces'),
    kg: b.weight_kg ?? sum(booked, 'weight'),
    cbm: b.volume_m3 ?? sum(booked, 'cbm'),
  }
  const act = { pcs: b.act_pcs, kg: b.act_kg, cbm: b.act_cbm }
  const out = cargoOf(b)
  const bkChg = bk.kg != null || bk.cbm != null ? Math.ceil(Math.max(bk.kg ?? 0, (bk.cbm ?? 0) * 167)) : null
  const actChg = act.kg != null ? Math.ceil(Math.max(act.kg ?? 0, (act.cbm ?? 0) * 167)) : null

  const rows: [string, number | null, number | null, number | null, number][] = [
    ['Pieces', bk.pcs, act.pcs, out.pcs, 0],
    ['Gross kg', bk.kg, act.kg, out.kg, 1],
    ['Volume m³', bk.cbm, act.cbm, out.cbm, 3],
    ['Chargeable kg', bkChg, actChg, out.chg, 0],
  ]
  const raw = b.goods_description ?? b.commodity ?? ''
  const clean = cleanForTw(raw)
  const changed = raw.trim() !== clean && raw.trim().length > 0

  return (
    <Card title="Cargo" aside={<span className="text-[11px] text-[#5B616E]">Warehouse actuals replace booked figures for export</span>}>
      <div className="px-4 pb-3.5 pt-1.5">
        <div className={`grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-x-3 border-b border-[#F1F2F5] py-2 ${lbl}`}>
          <span /><span className="text-right">Booked</span><span className="text-right">Checked in</span><span className="text-right">Exports as</span>
        </div>
        {rows.map(([k, a, c, o, dp]) => {
          const delta = a != null && c != null && Number(c) !== Number(a) ? Number(c) - Number(a) : null
          return (
            <div key={k} className="bk-mono grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center gap-x-3 border-b border-[#F6F7F9] py-[7px] text-[12px]">
              <span className="font-sans text-[#5B616E]">{k}</span>
              <span className="text-right text-[#6B7280]">{fmtNum(a, dp)}</span>
              <span className="text-right">
                {c == null ? <span className="text-[#98A2B3]">—</span> : fmtNum(c, dp)}
                {delta ? <span className="ml-1 text-[10.5px] text-[#B54708]">{delta > 0 ? '+' : ''}{fmtNum(delta, dp)}</span> : null}
              </span>
              <span className="text-right font-medium">{fmtNum(o, dp)}</span>
            </div>
          )
        })}
        <div className="mt-3.5">
          <span className={lbl}>Dimensions</span>
          <EaPieceLines lines={lines} />
        </div>
        <div className="mt-3.5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1 md:col-span-2">
            <span className={lbl}>Goods description</span>
            <span className="text-[12.5px] text-[#14161A]">{clean || '—'}</span>
            {changed ? <span className="self-start"><Tag tone="navy">Cleaned for TradeWindow</Tag></span> : null}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className={lbl}>Value</span>
              <span className="bk-mono text-[12.5px]">{b.cargo_value != null ? `${b.cargo_value_currency ?? 'NZD'} ${fmtNum(b.cargo_value, 2)}` : '—'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className={lbl}>Dangerous goods</span>
              <span>{b.is_dg ? <Tag tone="red">Yes</Tag> : 'No'}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
