import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrencies } from '../../../hooks/useQuoteRefData'
import DateField from '../../../components/DateField'
import { listCartageZones, listCartageBands, type CartageZone, type CartageBand } from '../../cartage/cartageApi'
import {
  fetchCartageRateCard, updateCartageRateCardHeader,
  listCartageFclLines, saveCartageFclLines,
  listCartageLtlLanes, saveCartageLtlLanes,
  type CartageRateCardDetail as CardDetail, type CartageFclLineDraft, type CartageLtlLaneDraft,
} from './cartageRatesApi'
import CartageFclLinesGrid from './CartageFclLinesGrid'
import CartageLtlLanesGrid from './CartageLtlLanesGrid'
import CartageExcelImport from './CartageExcelImport'

const STATUSES = ['draft', 'validated', 'active', 'expired'] as const

export default function CartageRateCardDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { items: currencies } = useCurrencies()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [card, setCard] = useState<CardDetail | null>(null)
  const [zones, setZones] = useState<CartageZone[]>([])
  const [bands, setBands] = useState<CartageBand[]>([])
  const [lines, setLines] = useState<CartageFclLineDraft[]>([])
  const [originalIds, setOriginalIds] = useState<string[]>([])
  const [ltlLanes, setLtlLanes] = useState<CartageLtlLaneDraft[]>([])
  const [ltlOriginalIds, setLtlOriginalIds] = useState<string[]>([])
  const [savingHeader, setSavingHeader] = useState(false)
  const [savingLines, setSavingLines] = useState(false)
  const [savingLtl, setSavingLtl] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const [c, zs, bs] = await Promise.all([fetchCartageRateCard(id), listCartageZones(), listCartageBands()])
        if (cancelled) return
        setZones(zs)
        setBands(bs)
        if (!c) { setNotFound(true); setLoading(false); return }
        setCard(c)
        const [ls, lanes] = await Promise.all([listCartageFclLines(id), listCartageLtlLanes(id)])
        if (cancelled) return
        setLines(ls)
        setOriginalIds(ls.map((l) => l.dbId as string))
        setLtlLanes(lanes)
        setLtlOriginalIds(lanes.map((l) => l.dbId as string))
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  function setField<K extends keyof CardDetail>(k: K, v: CardDetail[K]) {
    setCard((c) => (c ? { ...c, [k]: v } : c))
  }

  async function saveHeader() {
    if (!card || savingHeader) return
    setSavingHeader(true)
    try {
      await updateCartageRateCardHeader(card.id, {
        title: card.title,
        currency_code: card.currency_code,
        valid_from: card.valid_from,
        valid_to: card.valid_to,
        status: card.status,
      })
      toast.success('Card details saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingHeader(false)
    }
  }

  async function saveLines() {
    if (savingLines) return
    for (const l of lines) {
      if (!l.origin_zone_id || !l.dest_zone_id || !l.container_size || l.base_rate === '' || isNaN(Number(l.base_rate))) {
        toast.error('Each line needs origin, destination, size (20/40), and a numeric base rate')
        return
      }
    }
    setSavingLines(true)
    try {
      await saveCartageFclLines(id, lines, originalIds)
      const ls = await listCartageFclLines(id)
      setLines(ls)
      setOriginalIds(ls.map((l) => l.dbId as string))
      toast.success('FCL lines saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingLines(false)
    }
  }

  async function saveLtl() {
    if (savingLtl) return
    for (const l of ltlLanes) {
      const hasBandRate = Object.values(l.band_rates).some((v) => v !== '' && !isNaN(Number(v)))
      const hasPerCbm = l.per_cbm !== '' && !isNaN(Number(l.per_cbm))
      if (!l.origin_zone_id || !l.dest_zone_id) {
        toast.error('Each LTL lane needs an origin and destination zone')
        return
      }
      if (!hasBandRate && !hasPerCbm) {
        toast.error('Each LTL lane needs a per-CBM rate or at least one band $/kg')
        return
      }
    }
    setSavingLtl(true)
    try {
      await saveCartageLtlLanes(id, ltlLanes, ltlOriginalIds)
      const lanes = await listCartageLtlLanes(id)
      setLtlLanes(lanes)
      setLtlOriginalIds(lanes.map((l) => l.dbId as string))
      toast.success('LTL lanes saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingLtl(false)
    }
  }

  async function reloadAll() {
    try {
      const [ls, lanes] = await Promise.all([listCartageFclLines(id), listCartageLtlLanes(id)])
      setLines(ls)
      setOriginalIds(ls.map((l) => l.dbId as string))
      setLtlLanes(lanes)
      setLtlOriginalIds(lanes.map((l) => l.dbId as string))
    } catch { /* ignore */ }
  }

  if (loading) return <div className="quotes-page"><div className="card quotes-page__card">Loading…</div></div>
  if (notFound) return (
    <div className="quotes-page"><div className="card quotes-page__card">
      <p>Rate card not found.</p>
      <button type="button" className="btn btn--inline" style={{ marginTop: 0 }} onClick={() => navigate('/setup/rates/cartage')}>Back to Domestic Cartage</button>
    </div></div>
  )
  if (!card) return null

  const fieldStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6 }
  const labelStyle = { fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }
  const divider = { margin: '24px 0', border: 0, borderTop: '1px solid var(--color-line)' }

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <Link to="/setup/rates/cartage" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted-foreground)', textDecoration: 'none', marginBottom: 8 }}>
            <ArrowLeft size={15} /> Domestic Cartage
          </Link>
          <h1>{card.title || 'Cartage rate card'}</h1>
          {card.vendor_name && <p style={{ margin: '4px 0 0', color: 'var(--muted-foreground)', fontSize: 14 }}>{card.vendor_name}</p>}
        </header>

        <section style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, maxWidth: 900 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Default currency</label>
              <select className="input" value={card.currency_code ?? ''} onChange={(e) => setField('currency_code', e.target.value || null)}>
                <option value="">—</option>
                {currencies.map((c) => (<option key={c.code} value={c.code}>{c.code} — {c.name}</option>))}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Status</label>
              <select className="input" value={card.status} onChange={(e) => setField('status', e.target.value)}>
                {STATUSES.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}
              </select>
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Title</label>
              <input className="input" value={card.title ?? ''} onChange={(e) => setField('title', e.target.value)} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Valid from</label>
              <DateField value={card.valid_from ?? null} onChange={(v) => setField('valid_from', v || null)} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Valid to</label>
              <DateField value={card.valid_to ?? null} onChange={(v) => setField('valid_to', v || null)} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn--inline" title="Save details" aria-label="Save details" style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={saveHeader} disabled={savingHeader}>
              <Save size={16} strokeWidth={2} />
            </button>
          </div>
        </section>

        <hr style={divider} />

        <section>
          <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>FCL lines <span className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 400 }}>· container 20/40, flat rate per zone-to-zone lane</span></h2>
          {zones.length === 0 && <p className="text-muted-foreground pad-inline">No zones defined yet. Add zones in Setup → Cartage before creating lines.</p>}
          <div style={{ marginTop: 10 }}>
            <CartageFclLinesGrid lines={lines} zones={zones} onChange={setLines} onSave={saveLines} saving={savingLines} />
          </div>
        </section>

        <hr style={divider} />

        <section>
          <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>LTL lanes <span className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 400 }}>· applies to LCL and Air; $/kg by weight band, or per-CBM (W/M for LCL)</span></h2>
          {bands.length === 0 && <p className="text-muted-foreground pad-inline">No weight bands defined. Add bands in Setup → Cartage before entering band rates.</p>}
          <div style={{ marginTop: 10 }}>
            <CartageLtlLanesGrid lanes={ltlLanes} zones={zones} bands={bands} onChange={setLtlLanes} onSave={saveLtl} saving={savingLtl} />
          </div>
        </section>

        <hr style={divider} />

        <section>
          <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Import from Excel <span className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 400 }}>(beta)</span></h2>
          <CartageExcelImport cardId={id} zones={zones} bands={bands} onImported={reloadAll} />
        </section>

        {err && <p style={{ color: '#B23B3B', fontSize: 13, marginTop: 10 }}>{err}</p>}
      </div>
    </div>
  )
}
