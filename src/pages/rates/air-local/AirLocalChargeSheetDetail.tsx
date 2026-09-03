import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { filterAirports, findAirport } from '../../../utils/filterAirports'
import { filterAirlines, findAirline } from '../../../utils/filterAirlines'
import TypeaheadChips, { type TypeaheadItem } from './TypeaheadChips'
import AirLocalChargeLinesGrid from './AirLocalChargeLinesGrid'
import {
  fetchAirLocalChargeSheet, updateAirLocalChargeSheetHeader,
  listAirLocalChargeLines, saveAirLocalChargeLines, groupForDirection,
  type AirLocalChargeSheetDetail, type AirLocalChargeLineDraft,
} from './airLocalChargesDetailApi'

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

const searchAirports = (q: string, limit: number): TypeaheadItem[] =>
  filterAirports(q, limit).map((a) => ({ code: a.iata, label: a.city || a.name }))
const resolveAirport = (code: string): string => {
  const a = findAirport(code)
  return a ? `${a.iata} · ${a.city || a.name}` : code
}
const searchAirlines = (q: string, limit: number): TypeaheadItem[] =>
  filterAirlines(q, limit).map((a) => ({ code: a.code, label: a.name }))
const resolveAirline = (code: string): string => {
  const a = findAirline(code)
  return a ? `${a.code} · ${a.name}` : code
}

export default function AirLocalChargeSheetDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [sheet, setSheet] = useState<AirLocalChargeSheetDetail | null>(null)
  const [lines, setLines] = useState<AirLocalChargeLineDraft[]>([])
  const [originalIds, setOriginalIds] = useState<string[]>([])
  const [savingHeader, setSavingHeader] = useState(false)
  const [savingLines, setSavingLines] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const s = await fetchAirLocalChargeSheet(id)
        if (cancelled) return
        if (!s) { setNotFound(true); setLoading(false); return }
        setSheet(s)
        const ls = await listAirLocalChargeLines(id)
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

  function setField<K extends keyof AirLocalChargeSheetDetail>(k: K, v: AirLocalChargeSheetDetail[K]) {
    setSheet((s) => (s ? { ...s, [k]: v } : s))
  }

  async function saveHeader() {
    if (!sheet || savingHeader) return
    if (sheet.valid_from && sheet.valid_to && sheet.valid_from > sheet.valid_to) {
      toast.error('Valid-to must be on or after valid-from'); return
    }
    setSavingHeader(true)
    try {
      await updateAirLocalChargeSheetHeader(sheet.id, {
        title: sheet.title, direction: sheet.direction, movement: sheet.movement,
        airport_codes: sheet.airport_codes, airline_codes: sheet.airline_codes,
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
      await saveAirLocalChargeLines(id, lines, originalIds, groupForDirection(sheet.direction))
      const ls = await listAirLocalChargeLines(id)
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
      <button type="button" className="btn" onClick={() => navigate('/setup/rates/air-local')}>Back to Air Local / Port Charges</button>
    </div></div>
  )
  if (!sheet) return null

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <Link to="/setup/rates/air-local" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted-foreground)', textDecoration: 'none', marginBottom: 8 }}>
            <ArrowLeft size={15} /> Air Local / Port Charges
          </Link>
          <h1>{sheet.title || 'Air local charge sheet'}</h1>
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
              <label style={labelStyle}>Airports</label>
              <TypeaheadChips value={sheet.airport_codes} onChange={(v) => setField('airport_codes', v)}
                search={searchAirports} resolve={resolveAirport} placeholder="Add airports… (e.g. AKL, NAN)" />
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Airlines</label>
              <TypeaheadChips value={sheet.airline_codes} onChange={(v) => setField('airline_codes', v)}
                search={searchAirlines} resolve={resolveAirline} placeholder="Add airlines… (optional)" />
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
          <AirLocalChargeLinesGrid rows={lines} direction={sheet.direction} defaultCurrency="" onChange={setLines} />
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
