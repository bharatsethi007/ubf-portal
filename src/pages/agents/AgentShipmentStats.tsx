import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { fmtMoney } from './agentStatsApi'

type Stats = {
  total: number; last_12m: number; in_transit: number; upcoming: number
  imports: number; exports: number; air: number; sea: number; fcl: number; lcl: number
  weight_kg: number | null; volume_m3: number | null; gp: number | null; revenue: number | null
  lanes: { lane: string; n: number }[]
}

const cell = 'flex min-w-0 flex-col gap-0.5 border-r border-[#F0F1F4] px-4 py-3 last:border-r-0'
const lbl = 'text-[11.5px] text-[#5B6474]'

function kg(v: number | null | undefined) {
  const n = Number(v ?? 0)
  return n >= 1000 ? `${(n / 1000).toLocaleString('en-NZ', { maximumFractionDigits: 1 })} t` : `${Math.round(n)} kg`
}

/** Shipments tab header for an agent: last 12 months by direction, mode, weight and GP. */
export default function AgentShipmentStats({ code }: { code: string }) {
  const [s, setS] = useState<Stats | null>(null)
  useEffect(() => {
    supabase.rpc('agent_shipment_stats', { p_code: code }).then(({ data }) => setS((data as Stats) ?? null))
  }, [code])

  const split = (a: number, b: number) => {
    const t = Math.max(1, a + b)
    return <span className="my-1.5 flex h-1.5 overflow-hidden rounded-full bg-[#F1F3F7]" aria-hidden="true"><span style={{ width: `${(a / t) * 100}%`, background: '#0A2472' }} /><span style={{ width: `${(b / t) * 100}%`, background: '#C7D0E6' }} /></span>
  }
  const margin = s?.revenue ? Math.round(((s.gp ?? 0) / s.revenue) * 100) : null

  return (
    <div className="mb-3.5 grid grid-cols-2 overflow-hidden rounded-[10px] border border-[#E6E8EE] bg-white md:grid-cols-3 xl:grid-cols-6">
      <div className={cell}><span className={lbl}>Shipments · 12 months</span><span className="text-[20px]">{s ? s.last_12m.toLocaleString('en-NZ') : '–'}</span><span className={lbl}>{s ? `${s.total.toLocaleString('en-NZ')} all time` : ''}</span></div>
      <div className={cell}><span className={lbl}>Live now</span><span className="text-[20px] text-[#1D4ED8]">{s?.in_transit ?? '–'}</span><span className={lbl}>{s ? `in transit · ${s.upcoming} booked` : ''}</span></div>
      <div className={cell} title="Import = free hand from agent. Export = booked with agent.">
        <span className={lbl}>Free hand · booked</span>
        <span className="text-[20px]">{s ? `${s.imports} · ${s.exports}` : '–'}</span>
        {s && split(s.imports, s.exports)}
      </div>
      <div className={cell}>
        <span className={lbl}>Mode</span>
        <span className="text-[20px]">{s ? `${s.sea} sea · ${s.air} air` : '–'}</span>
        <span className={lbl}>{s && s.sea ? `${s.fcl} FCL · ${s.lcl} LCL` : ''}</span>
      </div>
      <div className={cell}><span className={lbl}>Weight · volume</span><span className="text-[20px]">{s ? kg(s.weight_kg) : '–'}</span><span className={lbl}>{s ? `${Number(s.volume_m3 ?? 0).toLocaleString('en-NZ')} m³` : ''}</span></div>
      <div className={cell} title="Gross profit on these jobs, last 12 months"><span className={lbl}>Gross profit · 12m</span><span className="text-[20px] text-[#067647]">{s ? fmtMoney(s.gp) : '–'}</span>
        <span className="truncate text-[11.5px] text-[#5B6474]">{margin != null ? `${margin}% margin · ` : ''}{s?.lanes[0] ? `top ${s.lanes[0].lane}` : ''}</span></div>
    </div>
  )
}
