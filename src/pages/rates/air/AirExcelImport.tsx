import { useState, type ChangeEvent } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, X, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../../supabase'
import { findAirport } from '../../../utils/filterAirports'
import AirLinesGrid from './AirLinesGrid'
import { insertAirLines, type AirLineDraft } from '../airRatesApi'

type SheetData = { name: string; rows: string[][] }
type Props = { cardId: string; defaultCurrency: string; onImported: () => void }

function pickDefaultSheet(names: string[]): string {
  const score = (n: string) => {
    const s = n.toLowerCase(); let v = 0
    if (/air|rate|tariff|freight|import/.test(s)) v += 2
    if (/export|note|agent|contact|term|condition|search|list|office|fsc|ssc/.test(s)) v -= 2
    return v
  }
  return [...names].sort((a, b) => score(b) - score(a))[0] ?? names[0]
}

const s = (v: unknown) => (v != null ? String(v) : '')

function validateCodes(d: AirLineDraft): AirLineDraft {
  const oFound = d.origin_port_code ? !!findAirport(d.origin_port_code) : false
  const dFound = d.dest_port_code ? !!findAirport(d.dest_port_code) : false
  if (!oFound || !dFound) return { ...d, confidence: 'red', note: d.note || 'Check airport code(s)' }
  return d
}

export default function AirExcelImport({ cardId, defaultCurrency, onImported }: Props) {
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [fileName, setFileName] = useState('')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<AirLineDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [parsing, setParsing] = useState(false)

  const current = sheets.find((sh) => sh.name === selectedSheet)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const data: SheetData[] = wb.SheetNames.map((name) => ({
        name,
        rows: XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, raw: false, defval: '' }),
      }))
      setSheets(data)
      setSelectedSheet(pickDefaultSheet(wb.SheetNames))
      setDraft([]); setOpen(true)
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : 'Could not read file')
    }
  }

  async function parseWithAI() {
    if (parsing || !current) return
    setParsing(true)
    try {
      const { data, error } = await supabase.functions.invoke('rate-card-parse-air', {
        body: { rate_card_id: cardId, sheet: current.rows },
      })
      if (error) throw new Error(error.message || 'Parse failed')
      if (data?.error) throw new Error(data.error)
      const lines: any[] = Array.isArray(data?.lines) ? data.lines : []
      const drafts: AirLineDraft[] = lines.map((l, i) => validateCodes({
        key: `ai-${i}`, dbId: null,
        origin_port_code: (l.origin_port_code || '').toUpperCase(),
        dest_port_code: (l.dest_port_code || '').toUpperCase(),
        min_charge: l.min_charge != null ? s(l.min_charge) : '',
        rate_n: l.rate_n != null ? s(l.rate_n) : '',
        rate_45: l.rate_45 != null ? s(l.rate_45) : '',
        rate_100: l.rate_100 != null ? s(l.rate_100) : '',
        rate_250: l.rate_250 != null ? s(l.rate_250) : '',
        rate_500: l.rate_500 != null ? s(l.rate_500) : '',
        rate_1000: l.rate_1000 != null ? s(l.rate_1000) : '',
        markup_pct: '',
        currency_code: l.currency_code || defaultCurrency || '',
        transit_days: l.transit_days != null ? s(l.transit_days) : '',
        via: l.via || '',
        frequency: l.frequency || '',
        confidence: l.confidence === 'amber' || l.confidence === 'red' ? l.confidence : 'green',
        raw_origin: l.raw_origin || '',
        note: l.note || '',
      }))
      setDraft(drafts)
      toast.success(`Parsed ${drafts.length} line${drafts.length === 1 ? '' : 's'} — review before saving`)
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : 'Parse failed')
    } finally { setParsing(false) }
  }

  async function save() {
    if (saving) return
    if (draft.length === 0) { toast.error('Nothing to import'); return }
    const bad = draft.filter((l) => {
      const rates = [l.min_charge, l.rate_n, l.rate_45, l.rate_100, l.rate_250, l.rate_500, l.rate_1000]
      const hasRate = rates.some((v) => v !== '' && !isNaN(Number(v)))
      return !l.origin_port_code || !l.dest_port_code || !hasRate
    })
    if (bad.length) { toast.error(`${bad.length} line${bad.length === 1 ? '' : 's'} still need an origin, destination and at least one numeric rate — fix the red rows before saving`); return }
    setSaving(true)
    try {
      await insertAirLines(cardId, draft)
      toast.success(`Imported ${draft.length} line${draft.length === 1 ? '' : 's'}`)
      setOpen(false); onImported()
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : 'Import failed')
    } finally { setSaving(false) }
  }

  const previewRows = current ? current.rows.slice(0, 100) : []
  const maxCols = previewRows.reduce((m, r) => Math.max(m, r.length), 0)

  return (
    <div>
      <label className="btn btn--inline" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', width: 'auto' }}>
        <FileSpreadsheet size={15} /> Choose Excel file
        <input type="file" accept=".xlsx,.xls" onChange={onFile} style={{ display: 'none' }} />
      </label>
      {fileName && <span className="text-muted-foreground" style={{ fontSize: 12, marginLeft: 12 }}>{fileName}</span>}

      {open && current && (
        <div role="dialog" aria-modal="true"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !saving && !parsing) setOpen(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '5vh 5vw' }}>
          <div style={{ width: '90vw', height: '90vh', maxWidth: 1600, background: '#fff', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--color-line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: 16, margin: 0 }}>Import from Excel</h2>
                  <p className="text-muted-foreground" style={{ fontSize: 12, margin: '2px 0 0' }}>{fileName} · {current.rows.length} rows</p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <span className="text-muted-foreground">Sheet</span>
                  <select className="input input--sm" value={selectedSheet} onChange={(e) => { setSelectedSheet(e.target.value); setDraft([]) }}>
                    {sheets.map((sh) => (<option key={sh.name} value={sh.name}>{sh.name}</option>))}
                  </select>
                </label>
              </div>
              <button type="button" aria-label="Close" onClick={() => !saving && !parsing && setOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4 }}><X size={20} /></button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <section>
                <h3 style={{ fontSize: 13, margin: '0 0 8px', color: 'var(--muted-foreground)' }}>Source sheet (reference)</h3>
                <div className="table-wrap" style={{ maxHeight: 240, overflow: 'auto' }}>
                  <table className="data-table">
                    <tbody>
                      {previewRows.map((r, ri) => (
                        <tr key={ri}>{Array.from({ length: maxCols }).map((_, ci) => (<td key={ci} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{r[ci] ?? ''}</td>))}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 8px' }}>
                  <h3 style={{ fontSize: 13, margin: 0, color: 'var(--muted-foreground)' }}>Lane rates to import</h3>
                  <button type="button" className="btn btn--inline" style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={parseWithAI} disabled={parsing}>
                    <Sparkles size={14} /> {parsing ? 'Parsing…' : 'Parse with AI'}
                  </button>
                  {draft.length > 0 && <span className="text-muted-foreground" style={{ fontSize: 12 }}>{draft.length} lines</span>}
                </div>
                <AirLinesGrid lines={draft} defaultCurrency={defaultCurrency} onChange={setDraft} />
              </section>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '12px 20px', borderTop: '1px solid var(--color-line)' }}>
              <button type="button" className="btn btn--inline" style={{ marginTop: 0, background: 'transparent', color: 'var(--color-ink)', border: '1px solid var(--color-line)' }} onClick={() => !saving && !parsing && setOpen(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn--inline" style={{ marginTop: 0 }} onClick={save} disabled={saving || parsing}>{saving ? 'Saving…' : 'Save lines'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
