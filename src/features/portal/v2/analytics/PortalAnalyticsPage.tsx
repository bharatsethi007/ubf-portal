import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Boxes, Info, Package } from 'lucide-react'
import { usePorts } from '../../../../hooks/usePorts'
import { fmtNum } from '../homeModel'
import { CostPerKgChart, EmissionsChart, SpendChart, VolumeChart } from './AnalyticsCharts'
import { DelaysCard, LanesTable, PartiesTable } from './AnalyticsTables'
import { delta, fetchAnalytics, insights, money2, perKg, rateDelta, type AnalyticsV2 } from './analyticsApi'
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
  const airCpk = t ? perKg(t.air_spend, t.air_kg ?? 0) : null
  const airCpkPrev = p ? perKg(p.air_spend ?? 0, p.air_kg ?? 0) : null
  const lclCpm = t ? perKg(t.lcl_spend ?? 0, t.lcl_cbm ?? 0) : null
  const lclCpmPrev = p ? perKg(p.lcl_spend ?? 0, p.lcl_cbm ?? 0) : null
  const teu = a?.containers.teu ?? 0
  const airT = (t?.air_kg ?? 0) / 1000

  return (
    <div className="pv3-page">
      <div className="pv3-head pv3-rise">
        <div>
          <h1>Analytics</h1>
          <p>How your freight is moving: volume, trade lanes, suppliers and customers.</p>
        </div>
        <div className="pv3-seg pv3-an__range" role="group" aria-label="Period">
          {RANGES.map((r) => <button key={r} type="button" className={months === r ? 'pv3-seg__on' : ''} onClick={() => setMonths(r)}>{r < 12 ? `${r}M` : r === 12 ? '12M' : '24M'}</button>)}
        </div>
      </div>

      {err && <div className="pv3-error">{err}</div>}

      <div className="pv3-kpis pv3-an__kpis">
        <Kpi label="Shipments" value={t ? fmtNum(t.shipments) : '—'} d={t && p ? delta(t.shipments, p.shipments) : null} sub={t ? `${t.air} air · ${t.lcl ?? 0} LCL · ${t.fcl ?? 0} FCL` : ''} delay={0.02} />
        <Kpi label="FCL TEUs" value={a ? fmtNum(teu) : '—'} d={a?.containers_prior ? delta(teu, a.containers_prior.teu) : null} sub={a ? `${fmtNum(a.containers.n)} containers` : ''} delay={0.05} />
        <Kpi label="LCL volume" value={t ? `${fmtNum(t.lcl_cbm ?? 0)} m³` : '—'} d={t && p ? delta(t.lcl_cbm ?? 0, p.lcl_cbm ?? 0) : null} sub={t ? `${t.lcl ?? 0} LCL shipments` : ''} delay={0.08} />
        <Kpi label="Air weight" value={t ? (airT >= 1 ? `${fmtNum(airT, true)} t` : `${fmtNum(t.air_kg ?? 0)} kg`) : '—'} d={t && p ? delta(t.air_kg ?? 0, p.air_kg ?? 0) : null} sub={t ? `${t.air} air shipments` : ''} delay={0.11} />
        <Kpi label="Air cost per kg" value={airCpk != null ? money2(airCpk) : '—'} d={rateDelta(airCpk, airCpkPrev)} goodDown sub={vs} delay={0.14} />
        <Kpi label="LCL cost per m³" value={lclCpm != null ? money2(lclCpm) : '—'} d={rateDelta(lclCpm, lclCpmPrev)} goodDown sub={vs} delay={0.17} />
      </div>

      {tips.length > 0 && (
        <section className="pv3-card pv3-an__hl pv3-rise" style={{ animationDelay: '.12s' }} aria-label="Highlights">
          {tips.map((i) => (
            <article key={i.eyebrow} className="pv3-an__hli">
              <span>{i.eyebrow}</span>
              <strong>{i.stat}</strong>
              <b title={i.title}>{i.title}</b>
              <p>{i.body}</p>
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
