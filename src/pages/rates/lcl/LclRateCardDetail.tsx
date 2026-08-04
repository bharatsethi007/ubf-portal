import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useCoLoaders, useCurrencies } from '../../../hooks/useQuoteRefData'
import {
  fetchLclRateCard, updateLclRateCardHeader, listLclLines, saveLclLines,
  listFclSurcharges, saveFclSurcharges,
  type LclRateCardDetail as CardDetail, type LclLineDraft, type FclSurchargeDraft,
} from '../ratesApi'
import LclLinesGrid from './LclLinesGrid'
import LclSurchargesGrid from './LclSurchargesGrid'
import LclExcelImport from './LclExcelImport'

const STATUSES = ['draft', 'validated', 'active', 'expired'] as const

function SaveIcon({ onClick, busy, label }: { onClick: () => void; busy: boolean; label: string }) {
  return (
    <button type="button" className="btn btn--inline" onClick={onClick} disabled={busy} title={label} aria-label={label} style={{ marginTop: 0, padding: '6px 10px' }}>
      <Save size={16} />
    </button>
  )
}

export default function LclRateCardDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { items: coLoaders } = useCoLoaders()
  const { items: currencies } = useCurrencies()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [card, setCard] = useState<CardDetail | null>(null)
  const [lines, setLines] = useState<LclLineDraft[]>([])
  const [originalIds, setOriginalIds] = useState<string[]>([])
  const [surcharges, setSurcharges] = useState<FclSurchargeDraft[]>([])
  const [surchargeIds, setSurchargeIds] = useState<string[]>([])
  const [savingSurcharges, setSavingSurcharges] = useState(false)
  const [savingHeader, setSavingHeader] = useState(false)
  const [savingLines, setSavingLines] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const c = await fetchLclRateCard(id)
        if (cancelled) return
        if (!c) { setNotFound(true); setLoading(false); return }
        setCard(c)
        const ls = await listLclLines(id)
        if (cancelled) return
        setLines(ls); setOriginalIds(ls.map((l) => l.dbId as string))
        const scs = await listFclSurcharges(id)
        if (cancelled) return
        setSurcharges(scs); setSurchargeIds(scs.map((s) => s.dbId as string))
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  function setField<K extends keyof CardDetail>(k: K, v: CardDetail[K]) { setCard((c) => (c ? { ...c, [k]: v } : c)) }

  async function saveHeader() {
    if (!card || savingHeader) return
    setSavingHeader(true)
    try {
      await updateLclRateCardHeader(card.id, {
        co_loader_code: card.co_loader_code, title: card.title, currency_code: card.currency_code,
        valid_from: card.valid_from, valid_to: card.valid_to, status: card.status,
      })
      toast.success('Card details saved')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') } finally { setSavingHeader(false) }
  }

  async function saveLines() {
    if (savingLines) return
    for (const l of lines) {
      if (!l.origin_port_code || !l.dest_port_code || l.rate_per_wm === '' || isNaN(Number(l.rate_per_wm))) {
        toast.error('Each line needs an origin, destination, and numeric rate per w/m'); return
      }
    }
    setSavingLines(true)
    try {
      await saveLclLines(id, lines, originalIds)
      const ls = await listLclLines(id)
      setLines(ls); setOriginalIds(ls.map((l) => l.dbId as string))
      toast.success('Lines saved')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') } finally { setSavingLines(false) }
  }

  async function saveSurcharges() {
    if (savingSurcharges) return
    for (const s of surcharges) {
      if (!s.label.trim() || s.amount === '' || isNaN(Number(s.amount))) { toast.error('Each surcharge needs a label and a numeric amount'); return }
    }
    setSavingSurcharges(true)
    try {
      await saveFclSurcharges(id, surcharges, surchargeIds)
      const scs = await listFclSurcharges(id)
      setSurcharges(scs); setSurchargeIds(scs.map((s) => s.dbId as string))
      toast.success('Surcharges saved')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') } finally { setSavingSurcharges(false) }
  }

  async function reloadLines() {
    try { const ls = await listLclLines(id); setLines(ls); setOriginalIds(ls.map((l) => l.dbId as string)) } catch { /* ignore */ }
  }

  if (loading) return <div className="quotes-page"><div className="card quotes-page__card">Loading…</div></div>
  if (notFound) return (
    <div className="quotes-page"><div className="card quotes-page__card">
      <p>Rate card not found.</p>
      <button type="button" className="btn" onClick={() => navigate('/setup/rates/lcl')}>Back to Sea LCL Charges</button>
    </div></div>
  )
  if (!card) return null

  const fieldStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6 }
  const labelStyle = { fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }
  const headRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 12px' } as const

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <Link to="/setup/rates/lcl" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted-foreground)', textDecoration: 'none', marginBottom: 8 }}>
            <ArrowLeft size={15} /> Sea LCL Charges
          </Link>
          <h1>{card.title || 'LCL rate card'}</h1>
        </header>

        <section style={{ marginTop: 8 }}>
          <div style={headRow}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Card details</h2>
            <SaveIcon onClick={saveHeader} busy={savingHeader} label="Save details" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, maxWidth: 900 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Co-loader</label>
              <select className="input" value={card.co_loader_code} onChange={(e) => setField('co_loader_code', e.target.value)}>
                {coLoaders.map((c) => (<option key={c.code} value={c.code}>{c.name}</option>))}
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
        </section>

        <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid var(--border, rgba(0,0,0,.08))' }} />

        <section>
          <div style={headRow}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Lane rates</h2>
            <SaveIcon onClick={saveLines} busy={savingLines} label="Save lines" />
          </div>
          <LclLinesGrid lines={lines} defaultCurrency={card.currency_code ?? ''} onChange={setLines} />
        </section>

        <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid var(--border, rgba(0,0,0,.08))' }} />

        <section>
          <div style={headRow}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Surcharges</h2>
            <SaveIcon onClick={saveSurcharges} busy={savingSurcharges} label="Save surcharges" />
          </div>
          <LclSurchargesGrid rows={surcharges} defaultCurrency={card.currency_code ?? ''} onChange={setSurcharges} />
        </section>

        <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid var(--border, rgba(0,0,0,.08))' }} />

        <section>
          <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Import from Excel <span className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 400 }}>(beta)</span></h2>
          <LclExcelImport cardId={id} defaultCurrency={card.currency_code ?? ''} onImported={reloadLines} />
        </section>

        {err && <p style={{ color: '#B23B3B', fontSize: 13, marginTop: 10 }}>{err}</p>}
      </div>
    </div>
  )
}
