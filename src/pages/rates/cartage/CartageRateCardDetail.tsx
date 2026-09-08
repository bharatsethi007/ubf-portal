import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrencies } from '../../../hooks/useQuoteRefData'
import DateField from '../../../components/DateField'
import { listCartageZones, type CartageZone } from '../../cartage/cartageApi'
import {
  fetchCartageRateCard, updateCartageRateCardHeader,
  listCartageFclLines, saveCartageFclLines,
  type CartageRateCardDetail as CardDetail, type CartageFclLineDraft,
} from './cartageRatesApi'
import CartageFclLinesGrid from './CartageFclLinesGrid'

const STATUSES = ['draft', 'validated', 'active', 'expired'] as const

export default function CartageRateCardDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { items: currencies } = useCurrencies()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [card, setCard] = useState<CardDetail | null>(null)
  const [zones, setZones] = useState<CartageZone[]>([])
  const [lines, setLines] = useState<CartageFclLineDraft[]>([])
  const [originalIds, setOriginalIds] = useState<string[]>([])
  const [savingHeader, setSavingHeader] = useState(false)
  const [savingLines, setSavingLines] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const [c, zs] = await Promise.all([fetchCartageRateCard(id), listCartageZones()])
        if (cancelled) return
        setZones(zs)
        if (!c) { setNotFound(true); setLoading(false); return }
        setCard(c)
        const ls = await listCartageFclLines(id)
        if (cancelled) return
        setLines(ls)
        setOriginalIds(ls.map((l) => l.dbId as string))
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
          <button type="button" className="btn btn--inline" style={{ marginTop: 16 }} onClick={saveHeader} disabled={savingHeader}>
            {savingHeader ? 'Saving…' : 'Save details'}
          </button>
        </section>

        <hr style={divider} />

        <section>
          <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>FCL lines <span className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 400 }}>· container 20/40, flat rate per zone-to-zone lane</span></h2>
          {zones.length === 0 && <p className="text-muted-foreground pad-inline">No zones defined yet. Add zones in Setup → Cartage before creating lines.</p>}
          <div style={{ marginTop: 10 }}>
            <CartageFclLinesGrid lines={lines} zones={zones} onChange={setLines} />
          </div>
          <div style={{ marginTop: 14 }}>
            <button type="button" className="btn btn--inline" style={{ marginTop: 0 }} onClick={saveLines} disabled={savingLines}>
              {savingLines ? 'Saving…' : 'Save FCL lines'}
            </button>
          </div>
        </section>

        <hr style={divider} />

        <section>
          <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>LTL lanes &amp; band rates</h2>
          <p className="text-muted-foreground pad-inline">Coming next (U4b-2): zone-to-zone LTL lanes with per-weight-band rates for LCL and Air.</p>
        </section>

        {err && <p style={{ color: '#B23B3B', fontSize: 13, marginTop: 10 }}>{err}</p>}
      </div>
    </div>
  )
}
