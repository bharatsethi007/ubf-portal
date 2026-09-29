import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Boxes, Info, Lightbulb, Package, TrendingDown, TrendingUp } from 'lucide-react'
import { usePorts } from '../../../../hooks/usePorts'
import { fmtMoney, fmtNum } from '../homeModel'
import { CostPerKgChart, EmissionsChart, SpendChart, VolumeChart } from './AnalyticsCharts'
import { DelaysCard, LanesTable, PartiesTable } from './AnalyticsTables'
import { delta, fetchAnalytics, insights, money2, perKg, type AnalyticsV2 } from './analyticsApi'
import './analytics.css'

const RANGES = [3, 6, 12, 24] as const

function Kpi({ label, value, sub, d, goodDown, delay }: { label: string; value: string; sub?: string; d?: number | null; goodDown?: boolean; delay: number }) {
  const good = d == null ? null : goodDown ? d < 0 : d > 0
  return (
    <div className="pv3-card pv3-kpi pv3-rise" style={{ animationDelay: `${delay}s` }}>
      <span className="pv3-kpi__label">{label}</span>
      <span className="pv3-kpi__value">{value}</span>
      <span className="pv3-kpi__sub">
        {d != null && d !== 0 && (
          <b className={`pv3-an__delta pv3-an__delta--${good ? 'good' : 'bad'}`}>
            {d > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(d)}%
          </b>
        )}
        {sub}
      </span>
    </div>
  )
}

/** Customer analytics: volume, spend, cost per kg, lanes, suppliers, reliability and emissions. */
export default function PortalAnalyticsPage() {
  const { ports } = usePorts()
  const [months, setMonths] = useState<number>(12)
  const [a, setA] = useState<AnalyticsV2 | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    setErr('')
    fetchAnalytics(months).then((r) => { if (alive) setA(r) }).catch((e) => { if (alive) setErr(e.message) })
    return () => { alive = false }
  }, [months])

  const tips = useMemo(() => (a ? insights(a, ports) : []), [a, ports])
  const t = a?.totals, p = a?.prior
  const vs = `vs previous ${months} months`
  const cpk = t ? perKg(t.spend, t.kg) : null
  const cpkPrev = p ? perKg(p.spend, p.kg) : null
  const onTime = t && t.arrived_n >= 5 ? Math.round((t.on_time / t.arrived_n) * 100) : null

  return (
    <div className="pv3-page">
      <div className="pv3-head pv3-rise">
        <div>
          <h1>Analytics</h1>
          <p>How your freight is performing: cost, volume, lanes, suppliers and emissions.</p>
        </div>
        <div className="pv3-seg pv3-an__range" role="group" aria-label="Period">
          {RANGES.map((r) => <button key={r} type="button" className={months === r ? 'pv3-seg__on' : ''} onClick={() => setMonths(r)}>{r < 12 ? `${r}M` : r === 12 ? '12M' : '24M'}</button>)}
        </div>
      </div>

      {err && <div className="pv3-error">{err}</div>}

      <div className="pv3-kpis pv3-an__kpis">
        <Kpi label="Shipments" value={t ? fmtNum(t.shipments) : '—'} d={t && p ? delta(t.shipments, p.shipments) : null} sub={t ? `${t.sea} sea · ${t.air} air` : ''} delay={0.02} />
        <Kpi label="Freight spend" value={t ? fmtMoney(t.spend, 'NZD', true) : '—'} d={t && p ? delta(t.spend, p.spend) : null} goodDown sub={vs} delay={0.05} />
        <Kpi label="Cost per kg" value={cpk != null ? money2(cpk) : '—'} d={cpk != null && cpkPrev != null ? Math.round(((cpk - cpkPrev) / cpkPrev) * 100) : null} goodDown sub={vs} delay={0.08} />
        <Kpi label="Weight shipped" value={t ? `${fmtNum(t.kg / 1000, true)} t` : '—'} d={t && p ? delta(t.kg, p.kg) : null} sub={t ? `${fmtNum(t.cbm)} m³` : ''} delay={0.11} />
        <Kpi label="Containers" value={a ? fmtNum(a.containers.n) : '—'} sub={a ? `${fmtNum(a.containers.teu)} TEU` : ''} delay={0.14} />
        <Kpi label={onTime != null ? 'On time' : 'CO₂e estimate'} value={onTime != null ? `${onTime}%` : t ? `${fmtNum(t.co2_kg / 1000, true)} t` : '—'}
          sub={onTime != null ? `of ${t!.arrived_n} tracked arrivals` : 'sea and air, GLEC defaults'} delay={0.17} />
      </div>

      {tips.length > 0 && (
        <section className="pv3-an__insights pv3-rise" style={{ animationDelay: '.12s' }} aria-label="Insights">
          {tips.map((i) => (
            <article key={i.title} className={`pv3-card pv3-an__insight pv3-an__insight--${i.tone}`}>
              <span className="pv3-an__iico">{i.tone === 'good' ? <TrendingDown size={16} /> : i.tone === 'watch' ? <TrendingUp size={16} /> : <Lightbulb size={16} />}</span>
              <div><b>{i.title}</b><p>{i.body}</p></div>
            </article>
          ))}
        </section>
      )}

      {a ? (
        <>
          <div className="pv3-an__grid">
            <VolumeChart months={a.months} delay={0.14} />
            <SpendChart months={a.months} total={a.totals.spend} delay={0.18} />
            <CostPerKgChart months={a.months} delay={0.22} />
            <EmissionsChart months={a.months} total={a.totals.co2_kg} delay={0.26} />
          </div>
          <LanesTable lanes={a.lanes} ports={ports} />
          <PartiesTable parties={a.parties} ports={ports} />
          <div className="pv3-an__two">
            <DelaysCard delays={a.delays} ports={ports} />
            <section className="pv3-card pv3-an__cta pv3-rise">
              <Package size={22} />
              <div>
                <b>Go down to SKU level</b>
                <p>Upload your products and purchase orders to see where every SKU is, what's still to ship, lead times and landed cost per unit.</p>
              </div>
              <Link to="/portal/products" className="pv3-btn pv3-btn--primary"><Boxes size={15} /> Products & POs</Link>
            </section>
          </div>
          <p className="pv3-foot pv3-an__foot"><Info size={12} /> Spend is from UB Freight invoices. Transit and on-time use tracked actual dates where we have them. CO₂e is an estimate from great-circle distance and weight.</p>
        </>
      ) : !err && (
        <div className="pv3-an__grid">{[0, 1, 2, 3].map((i) => <div key={i} className="pv3-card pv3-skel-card" />)}</div>
      )}
    </div>
  )
}
