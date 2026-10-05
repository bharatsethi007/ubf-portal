import { useEffect, useState } from 'react'
import { Search, AlertTriangle, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listCartageZones, type CartageZone } from '../cartage/cartageApi'
import { learnCartageAliases } from '../rates/cartage/cartageRatesApi'
import { carrierLogo } from './cartageSearchApi'
import { cartageResponseLines } from './rateOptionCartage'
import type { QuoteResponseLine } from './quoteResponseLinesApi'
import { loadCartagePrefill, type CartagePrefill } from './cartageSearchPrefill'
import { searchCartage, type CartageKind, type CartageLeg, type CartageOpt, type CartageSearchResult } from './cartageSearchRun'

type Props = { quoteId: string; open: boolean; onOpenChange: (o: boolean) => void; onAdd: (lines: QuoteResponseLine[]) => void }

const Z = 'z-[110]'
const lbl = 'block text-xs text-slate-500 mb-1'
const money = (n: number) => `NZD ${n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function CartageSearchDialog({ quoteId, open, onOpenChange, onAdd }: Props) {
  const [p, setP] = useState<CartagePrefill | null>(null)
  const [zones, setZones] = useState<CartageZone[]>([])
  const [resi, setResi] = useState(false)
  const [tail, setTail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<CartageSearchResult | null>(null)
  const [pick, setPick] = useState('')
  const [fixZone, setFixZone] = useState('')

  useEffect(() => {
    if (!open) return
    setRes(null); setPick('')
    loadCartagePrefill(quoteId).then(setP).catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load quote'))
    listCartageZones().then(setZones).catch(() => {})
  }, [open, quoteId])

  if (!p) return null
  const leg = p.leg
  const door = p.doors[leg]
  const set = (patch: Partial<CartagePrefill>) => { setP({ ...p, ...patch }); setRes(null); setPick('') }
  const setDoor = (k: keyof typeof door, v: string) => set({ doors: { ...p.doors, [leg]: { ...door, [k]: v } } })
  const setPort = (v: string) => set({ ports: { ...p.ports, [leg]: v } })

  async function run() {
    if (!p) return
    if (!p.ports[leg]) { toast.error('Enter port'); return }
    if (!door.suburb && !door.postcode && !door.address) { toast.error('Enter door suburb or postcode'); return }
    setBusy(true)
    try {
      const r = await searchCartage({ leg, port: p.ports[leg], door, kind: p.kind, pcs: p.pcs, kg: p.kg, cbm: p.cbm, fcl: p.fcl, residential: resi, tailLift: tail })
      setRes(r)
      const isAkl = ['NZAKL', 'AKL'].includes(p.ports[leg].toUpperCase())
      const ubf = r.options.find((o) => o.source === 'ubf')
      setPick((isAkl && ubf ? ubf : r.options[0])?.key ?? '')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Search failed') } finally { setBusy(false) }
  }

  async function learnZone() {
    const raw = door.postcode || door.suburb || door.address
    if (!fixZone || !raw) return
    try { await learnCartageAliases([{ raw, zone_id: fixZone }]); setFixZone(''); toast.success('Zone saved'); await run() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save zone') }
  }

  function add() {
    const o = res?.options.find((x) => x.key === pick)
    if (!o) return
    const label = o.source === 'ubf' ? 'Cartage' : `Cartage${o.service ? ' · ' + o.service : ''}`
    onAdd(cartageResponseLines({ leg, label, amount: o.charge, cost: o.cost, status: 'ok', source: o.source, carrier: o.carrier, carrierShort: o.carrier }))
    onOpenChange(false)
  }

  const portBox = (
    <div><label className={lbl}>Port</label>
      <input className="nqd-input" value={p.ports[leg]} onChange={(e) => setPort(e.target.value.toUpperCase())} /></div>
  )
  const doorBox = (
    <div className="grid grid-cols-2 gap-2">
      <div><label className={lbl}>Suburb / city</label><input className="nqd-input" value={door.suburb} onChange={(e) => setDoor('suburb', e.target.value)} /></div>
      <div><label className={lbl}>Postcode</label><input className="nqd-input" value={door.postcode} onChange={(e) => setDoor('postcode', e.target.value)} /></div>
      <div className="col-span-2"><label className={lbl}>Street address</label><input className="nqd-input" value={door.address} onChange={(e) => setDoor('address', e.target.value)} /></div>
    </div>
  )
  const legBtn = (v: CartageLeg, t: string) => (
    <button type="button" className={`nqd-btn ${leg === v ? 'nqd-btn--accent' : ''}`} disabled={p.legFixed && leg !== v} onClick={() => set({ leg: v })}>{t}</button>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-3xl ${Z}`} overlayClassName={Z}>
        <DialogHeader><DialogTitle>Cartage search</DialogTitle></DialogHeader>

        <div className="flex gap-2">{legBtn('origin', 'Pickup → port')}{legBtn('dest', 'Port → delivery')}</div>

        <div className="grid grid-cols-2 gap-4">
          <div><div className="text-sm font-medium mb-2">From</div>{leg === 'origin' ? doorBox : portBox}</div>
          <div><div className="text-sm font-medium mb-2">To</div>{leg === 'origin' ? portBox : doorBox}</div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div><label className={lbl}>Load</label>
            <select className="nqd-input" style={{ width: 110 }} value={p.kind} onChange={(e) => set({ kind: e.target.value as CartageKind })}>
              <option value="fcl">FCL</option><option value="lcl">LCL</option><option value="air">Air</option>
            </select></div>
          {p.kind === 'fcl' ? (
            <div className="text-sm text-slate-600 pb-2">{p.fcl.length ? p.fcl.map((u) => `${u.qty} x ${u.size}ft${u.kgPer ? ` (${u.kgPer} kg)` : ''}`).join(' · ') : 'No containers on quote'}</div>
          ) : (
            <>
              <div><label className={lbl}>Pcs</label><input type="number" className="nqd-input" style={{ width: 80 }} value={p.pcs || ''} onChange={(e) => set({ pcs: Number(e.target.value) || 0 })} /></div>
              <div><label className={lbl}>Kg</label><input type="number" className="nqd-input" style={{ width: 100 }} value={p.kg || ''} onChange={(e) => set({ kg: Number(e.target.value) || 0 })} /></div>
              <div><label className={lbl}>CBM</label><input type="number" className="nqd-input" style={{ width: 90 }} value={p.cbm || ''} onChange={(e) => set({ cbm: Number(e.target.value) || 0 })} /></div>
              <label className="flex items-center gap-1 text-sm pb-2"><input type="checkbox" checked={tail} onChange={(e) => setTail(e.target.checked)} /> Tail lift</label>
              <label className="flex items-center gap-1 text-sm pb-2"><input type="checkbox" checked={resi} onChange={(e) => setResi(e.target.checked)} /> Residential</label>
            </>
          )}
          <button type="button" className="nqd-btn nqd-btn--accent ml-auto" onClick={run} disabled={busy} title="Search rates" aria-label="Search rates">
            <Search size={15} /> {busy ? 'Searching…' : 'Search'}
          </button>
        </div>

        {res && <Results res={res} pick={pick} setPick={setPick} zones={zones} fixZone={fixZone} setFixZone={setFixZone} learnZone={learnZone} />}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!pick} onClick={add}>Add line</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Results({ res, pick, setPick, zones, fixZone, setFixZone, learnZone }: {
  res: CartageSearchResult; pick: string; setPick: (k: string) => void
  zones: CartageZone[]; fixZone: string; setFixZone: (z: string) => void; learnZone: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {res.ubfStatus === 'no_zone' && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-amber-700">
          <AlertTriangle size={15} /> Door not matched to a UBF zone. Pick it once, it gets remembered.
          <select className="nqd-input" style={{ width: 240, height: 30 }} value={fixZone} onChange={(e) => setFixZone(e.target.value)}>
            <option value="">Select zone…</option>
            {zones.filter((z) => z.zone_type === 'area').map((z) => <option key={z.id} value={z.id}>{z.zone_code} {'·'} {z.name}</option>)}
          </select>
          <button type="button" className="nqd-btn" disabled={!fixZone} onClick={learnZone} title="Save zone and search" aria-label="Save zone"><Check size={15} /></button>
        </div>
      )}
      {res.options.length === 0 ? (
        <p className="text-sm text-slate-500">No rates found for this lane.</p>
      ) : (
        <table className="data-table w-full text-sm">
          <thead><tr><th /><th>Carrier</th><th>Service</th><th className="text-right">Buy</th><th className="text-right">Sell</th></tr></thead>
          <tbody>
            {res.options.map((o: CartageOpt) => {
              const logo = carrierLogo(o.carrier)
              return (
                <tr key={o.key} className="row-clickable" onClick={() => setPick(o.key)}>
                  <td><input type="radio" checked={pick === o.key} onChange={() => setPick(o.key)} /></td>
                  <td>{logo ? <img src={logo} alt={o.carrier} style={{ height: 18 }} /> : o.carrier}</td>
                  <td>{o.service || '—'}{o.rural ? ' · rural' : ''}</td>
                  <td className="text-right">{money(o.cost)}</td>
                  <td className="text-right">{money(o.charge)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {res.notes.length > 0 && <p className="text-xs text-slate-500">{res.notes.join(' · ')}</p>}
    </div>
  )
}
