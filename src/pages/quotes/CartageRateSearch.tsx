import { useEffect, useMemo, useState } from 'react'
import { Truck, Search, Check, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { listCartageZones, type CartageZone } from '../cartage/cartageApi'
import { learnCartageAliases } from '../rates/cartage/cartageRatesApi'
import { fetchQuoteCartageContext, runCartageRate, type CartageCtx, type CartageQuoteResult } from './cartageSearchApi'

const DOOR_TYPES = ['Factory/Warehouse', 'Business address', 'Residential address']
const MODE_OPTS = [
  { v: 'fcl20', label: 'FCL 20ft' }, { v: 'fcl40', label: 'FCL 40ft' },
  { v: 'lcl', label: 'LCL (per kg / CBM)' }, { v: 'air', label: 'Air (chargeable wt)' },
]

type Leg = {
  key: 'origin' | 'dest'; title: string; direction: 'export' | 'import'
  port: string | null; postcode: string | null; city: string | null; raw: string | null; residential: boolean
}

function defaultMode(ctx: CartageCtx): string {
  const t = (ctx.shipment_type ?? '').toUpperCase(); const m = (ctx.shipment_mode ?? '').toLowerCase()
  if (m === 'air') return 'air'
  if (t.includes('LCL')) return 'lcl'
  return 'fcl20'
}

function legsFrom(ctx: CartageCtx): Leg[] {
  const out: Leg[] = []
  const isDoor = (t: string | null) => !!t && DOOR_TYPES.includes(t)
  if (isDoor(ctx.origin_type) && ctx.from_port) {
    out.push({ key: 'origin', title: `Origin cartage · pickup → ${ctx.from_port}`, direction: 'export', port: ctx.from_port,
      postcode: ctx.pickup_postal, city: ctx.pickup_location, raw: ctx.pickup_address, residential: ctx.origin_type === 'Residential address' })
  }
  if (isDoor(ctx.dest_type) && ctx.to_port) {
    out.push({ key: 'dest', title: `Destination cartage · ${ctx.to_port} → delivery`, direction: 'import', port: ctx.to_port,
      postcode: ctx.drop_postal, city: ctx.drop_location, raw: ctx.drop_address, residential: ctx.dest_type === 'Residential address' })
  }
  return out
}

export default function CartageRateSearch({ quoteId }: { quoteId: string }) {
  const [ctx, setCtx] = useState<CartageCtx | null>(null)
  const [zones, setZones] = useState<CartageZone[]>([])
  const [err, setErr] = useState('')

  useEffect(() => {
    fetchQuoteCartageContext(quoteId).then(setCtx).catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load'))
    listCartageZones().then(setZones).catch(() => {})
  }, [quoteId])

  const legs = useMemo(() => (ctx ? legsFrom(ctx) : []), [ctx])

  if (err) return <p style={{ color: '#B23B3B', fontSize: 13 }}>{err}</p>
  if (!ctx) return <p className="text-muted-foreground" style={{ fontSize: 13 }}>Loading…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Truck size={18} /> <h3 style={{ fontSize: 16, margin: 0 }}>Cartage rate search</h3>
      </div>
      {legs.length === 0 ? (
        <p className="text-muted-foreground" style={{ fontSize: 13 }}>
          No cartage leg on this quote — both ends are Port/Airport. Set an origin or destination to a door address (Factory/Business/Residential) to price cartage.
        </p>
      ) : legs.map((leg) => (
        <LegCard key={leg.key} leg={leg} mode0={defaultMode(ctx)} zones={zones} />
      ))}
    </div>
  )
}

function LegCard({ leg, mode0, zones }: { leg: Leg; mode0: string; zones: CartageZone[] }) {
  const [mode, setMode] = useState(mode0)
  const [weight, setWeight] = useState('')
  const [cbm, setCbm] = useState('')
  const [vol, setVol] = useState('')
  const [tail, setTail] = useState(false)
  const [running, setRunning] = useState(false)
  const [res, setRes] = useState<CartageQuoteResult | null>(null)
  const [fixZone, setFixZone] = useState('')

  const isFcl = mode === 'fcl20' || mode === 'fcl40'
  const isAir = mode === 'air'
  const isLcl = mode === 'lcl'

  async function run() {
    if (running) return
    setRunning(true)
    try {
      const r = await runCartageRate({
        door_postcode: leg.postcode, door_city: leg.city, door_raw: leg.raw,
        port_code: leg.port, direction: leg.direction, mode,
        weight_kg: Number(weight) || 0, cbm: Number(cbm) || 0, volume_cm3: Number(vol) || 0,
        residential: leg.residential, tail_lift: tail,
      })
      setRes(r)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rate search failed')
    } finally { setRunning(false) }
  }

  async function applyZoneFix() {
    if (!fixZone) return
    const raw = leg.postcode || leg.city || leg.raw
    if (!raw) { toast.error('No door text to learn from'); return }
    try {
      await learnCartageAliases([{ raw, zone_id: fixZone }])
      toast.success('Zone learned — re-searching')
      setFixZone('')
      await run()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save zone')
    }
  }

  const badge = (text: string, tone?: 'green' | 'amber' | 'red') => (
    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: tone === 'red' ? '#FBE9E9' : tone === 'amber' ? '#FCF3E2' : '#EEF1F5', color: tone === 'red' ? '#B23B3B' : tone === 'amber' ? '#B4791F' : '#5B6472' }}>{text}</span>
  )

  return (
    <div className="card quotes-page__card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <strong style={{ fontSize: 14 }}>{leg.title}</strong>
        {badge(leg.direction)}
        {badge(`door: ${leg.postcode || leg.city || '—'}`)}
        {leg.residential && badge('residential')}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div><label style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Mode</label>
          <select className="input input--sm" style={{ width: 170 }} value={mode} onChange={(e) => { setMode(e.target.value); setRes(null) }}>
            {MODE_OPTS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
          </select></div>
        {(isLcl || isAir) && <div><label style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Weight kg</label>
          <input className="input input--sm" style={{ width: 100 }} type="number" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>}
        {isLcl && <div><label style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>CBM</label>
          <input className="input input--sm" style={{ width: 90 }} type="number" value={cbm} onChange={(e) => setCbm(e.target.value)} /></div>}
        {isAir && <div><label style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Volume cm³</label>
          <input className="input input--sm" style={{ width: 110 }} type="number" value={vol} onChange={(e) => setVol(e.target.value)} /></div>}
        {isFcl && <div><label style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Gross kg (heavy)</label>
          <input className="input input--sm" style={{ width: 110 }} type="number" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>}
        {!isFcl && <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
          <input type="checkbox" checked={tail} onChange={(e) => setTail(e.target.checked)} /> Tail lift</label>}
        <button type="button" className="btn btn--inline" title="Search rate" aria-label="Search rate" style={{ marginTop: 0, marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={run} disabled={running}>
          <Search size={16} strokeWidth={2} />
        </button>
      </div>

      {res && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--color-line)', paddingTop: 12 }}>
          {res.status === 'ok' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Check size={16} color="#1B7F4B" /> <strong style={{ fontSize: 15 }}>Total {res.total}</strong>
                <span className="text-muted-foreground" style={{ fontSize: 12 }}>· {res.vendor}</span>
                {res.door_confidence && res.door_confidence !== 'green' && badge(`zone ${res.door_confidence}`, res.door_confidence as any)}
              </div>
              <div className="text-muted-foreground" style={{ fontSize: 13 }}>
                Base {res.base}{res.band ? ` · band ${res.band} @ ${res.per_kg}/kg · chargeable ${res.chargeable_kg}kg` : ''}
                {(res.surcharges ?? []).map((s) => ` · ${s.label} +${s.amount}`)}
              </div>
            </div>
          ) : res.status === 'no_zone' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={16} color="#B4791F" /> Door address didn't match a zone. Pick the correct zone — it'll be remembered.
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="input input--sm" style={{ width: 260 }} value={fixZone} onChange={(e) => setFixZone(e.target.value)}>
                  <option value="">Select zone…</option>
                  {zones.filter((z) => z.zone_type === 'area').map((z) => <option key={z.id} value={z.id}>{z.zone_code} · {z.name}</option>)}
                </select>
                <button type="button" className="btn btn--inline" title="Save zone & re-search" aria-label="Save zone" style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={applyZoneFix}><Check size={16} /></button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#B4791F', fontSize: 13 }}>
              <AlertTriangle size={16} /> No cartage rate found for this lane {(res.warnings ?? []).length > 0 ? `(${res.warnings!.join('; ')})` : ''}. Check the rate card has a matching lane.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
