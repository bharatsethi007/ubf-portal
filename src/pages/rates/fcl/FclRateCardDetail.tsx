import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useShippingLines, useCurrencies } from '../../../hooks/useQuoteRefData'
import {
  fetchFclRateCard, updateFclRateCardHeader, listFclLines, saveFclLines,
  type FclRateCardDetail as CardDetail, type FclLineDraft,
} from '../ratesApi'
import FclLinesGrid from './FclLinesGrid'

const STATUSES = ['draft', 'validated', 'active', 'expired'] as const

export default function FclRateCardDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { items: shippingLines } = useShippingLines()
  const { items: currencies } = useCurrencies()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [card, setCard] = useState<CardDetail | null>(null)
  const [lines, setLines] = useState<FclLineDraft[]>([])
  const [originalIds, setOriginalIds] = useState<string[]>([])
  const [savingHeader, setSavingHeader] = useState(false)
  const [savingLines, setSavingLines] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const c = await fetchFclRateCard(id)
        if (cancelled) return
        if (!c) { setNotFound(true); setLoading(false); return }
        setCard(c)
        const ls = await listFclLines(id)
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
      await updateFclRateCardHeader(card.id, {
        shipping_line_code: card.shipping_line_code,
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
      if (!l.dest_port_code || !l.container_type || l.base_rate === '' || isNaN(Number(l.base_rate))) {
        toast.error('Each line needs a destination, container, and numeric base rate')
        return
      }
    }
    setSavingLines(true)
    try {
      await saveFclLines(id, lines, originalIds)
      const ls = await listFclLines(id)
      setLines(ls)
      setOriginalIds(ls.map((l) => l.dbId as string))
      toast.success('Lines saved')
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
      <button type="button" className="btn" onClick={() => navigate('/setup/rates/fcl')}>Back to Sea FCL Charges</button>
    </div></div>
  )
  if (!card) return null

  const fieldStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6 }
  const labelStyle = { fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <Link to="/setup/rates/fcl" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted-foreground)', textDecoration: 'none', marginBottom: 8 }}>
            <ArrowLeft size={15} /> Sea FCL Charges
          </Link>
          <h1>{card.title || 'FCL rate card'}</h1>
        </header>

        <section style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, maxWidth: 900 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Shipping line</label>
              <select className="input" value={card.shipping_line_code} onChange={(e) => setField('shipping_line_code', e.target.value)}>
                {shippingLines.map((l) => (<option key={l.code} value={l.code}>{l.name}</option>))}
              </select>
            </div>
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
              <input type="date" className="input" value={card.valid_from ?? ''} onChange={(e) => setField('valid_from', e.target.value || null)} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Valid to</label>
              <input type="date" className="input" value={card.valid_to ?? ''} onChange={(e) => setField('valid_to', e.target.value || null)} />
            </div>
          </div>
          <button type="button" className="btn" style={{ marginTop: 16 }} onClick={saveHeader} disabled={savingHeader}>
            {savingHeader ? 'Saving…' : 'Save details'}
          </button>
        </section>

        <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid var(--border, rgba(0,0,0,.08))' }} />

        <section>
          <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Lane rates</h2>
          <FclLinesGrid lines={lines} defaultCurrency={card.currency_code ?? ''} onChange={setLines} />
          <div style={{ marginTop: 14 }}>
            <button type="button" className="btn" onClick={saveLines} disabled={savingLines}>
              {savingLines ? 'Saving…' : 'Save lines'}
            </button>
          </div>
        </section>

        {err && <p style={{ color: '#B23B3B', fontSize: 13, marginTop: 10 }}>{err}</p>}
      </div>
    </div>
  )
}
