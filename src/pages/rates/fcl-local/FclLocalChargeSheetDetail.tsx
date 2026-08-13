import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useShippingLines } from '../../../hooks/useQuoteRefData'
import { useSeaPorts } from '../../../hooks/useSeaPorts'
import MultiChipSelect from '../../../components/MultiChipSelect'
import LocalChargeLinesGrid from './LocalChargeLinesGrid'
import {
  fetchLocalChargeSheet, updateLocalChargeSheetHeader,
  listLocalChargeLines, saveLocalChargeLines, groupForDirection,
  type LocalChargeSheetDetail, type LocalChargeLineDraft,
} from './localChargesDetailApi'

const STATUSES = ['draft', 'validated', 'active', 'expired'] as const

const fieldStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6 }
const labelStyle = { fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'inline-flex', gap: 6 }}>
      {options.map((o) => {
        const on = value === o.v
        return (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
              border: on ? '1px solid #0A2472' : '1px solid var(--border, #D9DEE6)',
              background: on ? '#0A2472' : 'transparent', color: on ? '#fff' : 'var(--foreground, #1A2233)',
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export default function FclLocalChargeSheetDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { items: shippingLines } = useShippingLines()
  const { ports } = useSeaPorts()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [sheet, setSheet] = useState<LocalChargeSheetDetail | null>(null)
  const [lines, setLines] = useState<LocalChargeLineDraft[]>([])
  const [originalIds, setOriginalIds] = useState<string[]>([])
  const [savingHeader, setSavingHeader] = useState(false)
  const [savingLines, setSavingLines] = useState(false)
  const [err, setErr] = useState('')

  const portOptions = useMemo(() => ports.map((p) => ({ value: p.code, label: p.name })), [ports])
  const lineOptions = useMemo(() => shippingLines.map((l) => ({ value: l.code, label: l.name })), [shippingLines])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const s = await fetchLocalChargeSheet(id)
        if (cancelled) return
        if (!s) { setNotFound(true); setLoading(false); return }
        setSheet(s)
        const ls = await listLocalChargeLines(id)
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

  function setField<K extends keyof LocalChargeSheetDetail>(k: K, v: LocalChargeSheetDetail[K]) {
    setSheet((s) => (s ? { ...s, [k]: v } : s))
  }

  async function saveHeader() {
    if (!sheet || savingHeader) return
    if (sheet.valid_from && sheet.valid_to && sheet.valid_from > sheet.valid_to) {
      toast.error('Valid-to must be on or after valid-from'); return
    }
    setSavingHeader(true)
    try {
      await updateLocalChargeSheetHeader(sheet.id, {
        title: sheet.title, direction: sheet.direction, movement: sheet.movement,
        port_codes: sheet.port_codes, shipping_line_codes: sheet.shipping_line_codes,
        valid_from: sheet.valid_from, valid_to: sheet.valid_to, status: sheet.status,
      })
      toast.success('Sheet details saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingHeader(false)
    }
  }

  async function saveLines() {
    if (!sheet || savingLines) return
    for (const l of lines) {
      const hasBuy = l.buy_amount !== '' && !isNaN(Number(l.buy_amount))
      const hasSell = l.sell_amount !== '' && !isNaN(Number(l.sell_amount))
      if (!l.label.trim() || (!hasBuy && !hasSell)) {
        toast.error('Each line needs a label and a buy or sell amount'); return
      }
    }
    setSavingLines(true)
    try {
      await saveLocalChargeLines(id, lines, originalIds, groupForDirection(sheet.direction))
      const ls = await listLocalChargeLines(id)
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
      <p>Sheet not found.</p>
      <button type="button" className="btn" onClick={() => navigate('/setup/rates/fcl-local')}>Back to Sea FCL Local / Port Charges</button>
    </div></div>
  )
  if (!sheet) return null

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <Link to="/setup/rates/fcl-local" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted-foreground)', textDecoration: 'none', marginBottom: 8 }}>
            <ArrowLeft size={15} /> Sea FCL Local / Port Charges
          </Link>
          <h1>{sheet.title || 'Local charge sheet'}</h1>
        </header>

        <section style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, maxWidth: 960 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Direction</label>
              <Segmented value={sheet.direction} onChange={(v) => setField('direction', v)}
                options={[{ v: 'origin', label: 'Origin' }, { v: 'dest', label: 'Destination' }]} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Movement</label>
              <Segmented value={sheet.movement} onChange={(v) => setField('movement', v)}
                options={[{ v: 'import', label: 'Import' }, { v: 'export', label: 'Export' }]} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Status</label>
              <select className="input" value={sheet.status} onChange={(e) => setField('status', e.target.value)}>
                {STATUSES.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}
              </select>
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Title</label>
              <input className="input" value={sheet.title ?? ''} onChange={(e) => setField('title', e.target.value)} placeholder="e.g. Auckland — Import Destination Charges" />
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Ports</label>
              <MultiChipSelect options={portOptions} value={sheet.port_codes} onChange={(v) => setField('port_codes', v)} placeholder="Add ports… (e.g. AKL, LYT)" />
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Shipping lines</label>
              <MultiChipSelect options={lineOptions} value={sheet.shipping_line_codes} onChange={(v) => setField('shipping_line_codes', v)} placeholder="Add shipping lines…" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Valid from</label>
              <input type="date" className="input" value={sheet.valid_from ?? ''} onChange={(e) => setField('valid_from', e.target.value || null)} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Valid to</label>
              <input type="date" className="input" value={sheet.valid_to ?? ''} onChange={(e) => setField('valid_to', e.target.value || null)} />
            </div>
          </div>
          <button type="button" className="btn btn--inline" style={{ marginTop: 16 }} onClick={saveHeader} disabled={savingHeader}>
            {savingHeader ? 'Saving…' : 'Save details'}
          </button>
        </section>

        <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid var(--border, rgba(0,0,0,.08))' }} />

        <section>
          <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Charge lines</h2>
          <LocalChargeLinesGrid rows={lines} direction={sheet.direction} defaultCurrency="" onChange={setLines} />
          <div style={{ marginTop: 14 }}>
            <button type="button" className="btn btn--inline" onClick={saveLines} disabled={savingLines}>
              {savingLines ? 'Saving…' : 'Save lines'}
            </button>
          </div>
        </section>

        {err && <p style={{ color: '#B23B3B', fontSize: 13, marginTop: 10 }}>{err}</p>}
      </div>
    </div>
  )
}
