import { useEffect, useState } from 'react'
import { Truck, Check, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { listCartageZones, type CartageZone } from '../cartage/cartageApi'
import { learnCartageAliases } from '../rates/cartage/cartageRatesApi'
import { runCartageRate, type CartageQuoteResult } from './cartageSearchApi'

type Door = { postcode: string | null; city: string | null; address: string | null }
type Props = {
  movement: string | null
  fromPort: string | null
  toPort: string | null
  pickup: Door
  drop: Door
  shipmentType: string | null
  containers: { size: string; qty: number; weightMt: number | null }[]
  lcl: { weightKg: number; cbm: number }
  air: { weightKg: number; volumeCm3: number }
}

type Line = { label: string; qty: number; res: CartageQuoteResult }

const badge = (t: string, tone?: string) => (
  <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: tone === 'red' ? '#FBE9E9' : tone === 'amber' ? '#FCF3E2' : '#EEF1F5', color: tone === 'red' ? '#B23B3B' : tone === 'amber' ? '#B4791F' : '#5B6472' }}>{t}</span>
)

// Cartage auto-priced from what's already entered (address, container/size, weight, cargo).
// No separate inputs — it reads the quote's own fields and prices the NZ door leg.
export default function CartageAutoQuote(p: Props) {
  const [zones, setZones] = useState<CartageZone[]>([])
  const [resi, setResi] = useState(false)
  const [tail, setTail] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [running, setRunning] = useState(false)
  const [fixZone, setFixZone] = useState('')

  useEffect(() => { listCartageZones().then(setZones).catch(() => {}) }, [])

  const mv = (p.movement ?? '').toLowerCase()
  const leg = mv === 'import'
    ? { dir: 'import' as const, port: p.toPort, door: p.drop, title: `Destination cartage · ${p.toPort ?? '?'} → delivery` }
    : mv === 'export'
    ? { dir: 'export' as const, port: p.fromPort, door: p.pickup, title: `Origin cartage · pickup → ${p.fromPort ?? '?'}` }
    : null

  const isFcl = p.shipmentType === 'FCL'
  const isAir = p.shipmentType === 'Air'
  const hasDoor = !!leg && !!leg.port && !!leg.door && !!(leg.door.postcode || leg.door.city || leg.door.address)
  const key = JSON.stringify({ mv, leg: leg && { port: leg.port, door: leg.door }, st: p.shipmentType, c: p.containers, lcl: p.lcl, air: p.air, resi, tail })

  useEffect(() => {
    let cancelled = false
    async function go() {
      if (!leg || !hasDoor) { setLines([]); return }
      setRunning(true)
      try {
        const out: Line[] = []
        const common = { door_postcode: leg.door.postcode, door_city: leg.door.city, door_raw: leg.door.address, port_code: leg.port, direction: leg.dir, residential: resi }
        if (isFcl) {
          for (const c of p.containers) {
            if (!c.qty) continue
            const res = await runCartageRate({ ...common, mode: c.size.startsWith('40') ? 'fcl40' : 'fcl20', weight_kg: (c.weightMt ?? 0) * 1000, cbm: 0, volume_cm3: 0, tail_lift: false })
            out.push({ label: `${c.size} ×${c.qty}`, qty: c.qty, res })
          }
        } else if (isAir) {
          const res = await runCartageRate({ ...common, mode: 'air', weight_kg: p.air.weightKg, cbm: 0, volume_cm3: p.air.volumeCm3, tail_lift: tail })
          out.push({ label: 'Air cargo', qty: 1, res })
        } else {
          const res = await runCartageRate({ ...common, mode: 'lcl', weight_kg: p.lcl.weightKg, cbm: p.lcl.cbm, volume_cm3: 0, tail_lift: tail })
          out.push({ label: 'LCL cargo', qty: 1, res })
        }
        if (!cancelled) setLines(out)
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Cartage pricing failed')
      } finally { if (!cancelled) setRunning(false) }
    }
    const t = setTimeout(go, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!leg) return <p className="text-muted-foreground" style={{ fontSize: 13 }}>Set the movement (import/export) to price cartage.</p>
  if (!hasDoor) return <p className="text-muted-foreground" style={{ fontSize: 13 }}>Enter the {leg.dir === 'import' ? 'delivery' : 'pickup'} address to price cartage.</p>

  const total = lines.reduce((s, l) => s + (l.res.status === 'ok' ? (l.res.total ?? 0) * l.qty : 0), 0)
  const anyNoZone = lines.some((l) => l.res.status === 'no_zone')

  async function fixAndRerun() {
    if (!fixZone || !leg) return
    const raw = leg.door.postcode || leg.door.city || leg.door.address
    if (!raw) return
    try { await learnCartageAliases([{ raw, zone_id: fixZone }]); setFixZone(''); toast.success('Zone learned — re-pricing') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save zone') }
  }

  return (
    <div className="card quotes-page__card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Truck size={16} /> <strong style={{ fontSize: 14 }}>{leg.title}</strong>
        {badge(leg.dir)}
        {badge(`door: ${leg.door.postcode || leg.door.city || '—'}`)}
      </div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13 }}><input type="checkbox" checked={resi} onChange={(e) => setResi(e.target.checked)} /> Residential</label>
        {!isFcl && <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13 }}><input type="checkbox" checked={tail} onChange={(e) => setTail(e.target.checked)} /> Tail lift</label>}
        {running && <span className="text-muted-foreground" style={{ fontSize: 12 }}>pricing…</span>}
      </div>
      {lines.length === 0 ? (
        <p className="text-muted-foreground" style={{ fontSize: 13 }}>Add cargo / weight to price.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ fontSize: 13 }}>
              {l.res.status === 'ok' ? (
                <span><Check size={14} color="#1B7F4B" style={{ verticalAlign: 'middle' }} /> {l.label}: <strong>{l.res.total}</strong>{l.qty > 1 ? ` × ${l.qty} = ${(l.res.total ?? 0) * l.qty}` : ''} <span className="text-muted-foreground">· {l.res.vendor}</span> {l.res.door_confidence && l.res.door_confidence !== 'green' ? badge(`zone ${l.res.door_confidence}`, l.res.door_confidence) : null}</span>
              ) : l.res.status === 'no_zone' ? (
                <span style={{ color: '#B4791F' }}><AlertTriangle size={14} style={{ verticalAlign: 'middle' }} /> {l.label}: address didn't match a zone</span>
              ) : (
                <span style={{ color: '#B4791F' }}><AlertTriangle size={14} style={{ verticalAlign: 'middle' }} /> {l.label}: no cartage rate for this lane</span>
              )}
            </div>
          ))}
          {total > 0 && <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>Cartage total {total}</div>}
          {anyNoZone && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <select className="input input--sm" style={{ width: 260 }} value={fixZone} onChange={(e) => setFixZone(e.target.value)}>
                <option value="">Pick the correct zone…</option>
                {zones.filter((z) => z.zone_type === 'area').map((z) => <option key={z.id} value={z.id}>{z.zone_code} · {z.name}</option>)}
              </select>
              <button type="button" className="btn btn--inline" style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={fixAndRerun} title="Save zone & re-price"><Check size={16} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
