import { useState, type ChangeEvent } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, X, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../../supabase'
import FclLinesGrid from './FclLinesGrid'
import { useSeaPorts } from '../../../hooks/useSeaPorts'
import { insertFclLines, learnPortAliases, type FclLineDraft } from '../ratesApi'

type SheetData = { name: string; rows: string[][] }
type RateMode = 'buy' | 'sell'
type Props = { cardId: string; defaultCurrency: string; onImported: () => void }

function pickDefaultSheet(names: string[]): string {
  const score = (n: string) => {
    const s = n.toLowerCase(); let v = 0
    if (s.includes('import')) v += 2
    if (/tariff|rate|freight|sell/.test(s)) v += 2
    if (/export|note|agent|cfs|contact|term|condition|search|list|office/.test(s)) v -= 2
    return v
  }
  return [...names].sort((a, b) => score(b) - score(a))[0] ?? names[0]
}

export default function FclExcelImport({ cardId, defaultCurrency, onImported }: Props) {
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [mode, setMode] = useState<RateMode>('buy')
  const [fileName, setFileName] = useState('')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FclLineDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [parsing, setParsing] = useState(false)
  const { ports } = useSeaPorts()

  const current = sheets.find((s) => s.name === selectedSheet)

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

  // Flip buy<->sell and move any already-parsed rate values into the active column.
  function changeMode(next: RateMode) {
    if (next === mode) return
    setMode(next)
    setDraft((prev) => prev.map((l) => next === 'sell'
      ? { ...l, sell_rate: l.base_rate, base_rate: '' }
      : { ...l, base_rate: l.sell_rate ?? '', sell_rate: '' }))
  }

  async function parseWithAI() {
    if (parsing || !current) return
    setParsing(true)
    try {
      const { data, error } = await supabase.functions.invoke('rate-card-parse', {
        body: { rate_card_id: cardId, sheet: current.rows },
      })
      if (error) throw new Error(error.message || 'Parse failed')
      if (data?.error) throw new Error(data.error)
      const lines: any[] = Array.isArray(data?.lines) ? data.lines : []
      const drafts: FclLineDraft[] = lines.map((l, i) => {
        const rate = l.base_rate != null ? String(l.base_rate) : ''
        return {
          key: `ai-${i}`,
          dbId: null,
          origin_port_code: l.origin_port_code || '',
          dest_port_code: l.dest_port_code || '',
          container_type: l.container_type || '',
          base_rate: mode === 'buy' ? rate : '',
          sell_rate: mode === 'sell' ? rate : '',
          currency_code: l.currency_code || defaultCurrency || '',
          transit_days: l.transit_days != null ? String(l.transit_days) : '',
          via: l.via || '',
          confidence: l.confidence === 'amber' || l.confidence === 'red' ? l.confidence : 'green',
          raw_origin: l.raw_origin || '',
          note: l.note || '',
        }
      })
      setDraft(drafts)
      toast.success(`Parsed ${drafts.length} ${mode} line${drafts.length === 1 ? '' : 's'} — review before saving`)
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : 'Parse failed')
    } finally { setParsing(false) }
  }

  async function save() {
    if (saving) return
    if (draft.length === 0) { toast.error('Nothing to import'); return }
    const needSell = mode === 'sell'
    const bad = draft.filter((l) => {
      if (!l.origin_port_code || !l.dest_port_code || !l.container_type) return true
      return needSell
        ? (l.sell_rate ?? '') === '' || isNaN(Number(l.sell_rate))
        : l.base_rate === '' || isNaN(Number(l.base_rate))
    })
    if (bad.length) {
      toast.error(`${bad.length} line${bad.length === 1 ? '' : 's'} still need an origin, destination, container and numeric ${mode} rate — fix the “—” rows before saving`)
      return
    }
    setSaving(true)
    try {
      await insertFclLines(cardId, draft)
      toast.success(`Imported ${draft.length} ${mode} line${draft.length === 1 ? '' : 's'}`)
      try {
        const portByCode = new Map(ports.map((p) => [p.code, (p.name || '').toLowerCase()]))
        const pairs = draft
          .filter((l) => l.raw_origin && l.origin_port_code)
          .map((l) => ({ alias: (l.raw_origin as string).trim(), port_code: l.origin_port_code }))
          .filter((p) => {
            const raw = p.alias.toLowerCase()
            return raw && raw !== p.port_code.toLowerCase() && raw !== portByCode.get(p.port_code)
          })
        const learned = await learnPortAliases(pairs)
        if (learned > 0) toast.success(`Learned ${learned} new port alias${learned === 1 ? '' : 'es'}`)
      } catch { /* non-fatal */ }
      setOpen(false)
      onImported()
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : 'Import failed')
    } finally {
      setSaving(false)
    }
  }

  const previewRows = current ? current.rows.slice(0, 100) : []
  const maxCols = previewRows.reduce((m, r) => Math.max(m, r.length), 0)
  const busy = saving || parsing

  return (
    <div>
      <label className="btn btn--inline" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', width: 'auto' }}>
        <FileSpreadsheet size={15} /> Choose Excel file
        <input type="file" accept=".xlsx,.xls" onChange={onFile} style={{ display: 'none' }} />
      </label>
      {fileName && <span className="text-muted-foreground" style={{ fontSize: 12, marginLeft: 12 }}>{fileName}</span>}

      {open && current && (
        <div role="dialog" aria-modal="true"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false) }}
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
                  <select className="input input--sm" value={selectedSheet} disabled={busy} onChange={(e) => { setSelectedSheet(e.target.value); setDraft([]) }}>
                    {sheets.map((s) => (<option key={s.name} value={s.name}>{s.name}</option>))}
                  </select>
                </label>
                <fieldset disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 12, border: 'none', margin: 0, padding: 0, fontSize: 13 }}>
                  <span className="text-muted-foreground">These are</span>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                    <input type="radio" name="fcl-rate-mode" checked={mode === 'buy'} onChange={() => changeMode('buy')} /> Buy rates
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                    <input type="radio" name="fcl-rate-mode" checked={mode === 'sell'} onChange={() => changeMode('sell')} /> Sell rates
                  </label>
                </fieldset>
              </div>
              <button type="button" aria-label="Close" onClick={() => !busy && setOpen(false)}
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
                  <h3 style={{ fontSize: 13, margin: 0, color: 'var(--muted-foreground)' }}>Lane rates to import ({mode})</h3>
                  <button type="button" className="btn btn--inline" style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={parseWithAI} disabled={parsing}>
                    <Sparkles size={14} /> {parsing ? 'Parsing…' : 'Parse with AI'}
                  </button>
                  {draft.length > 0 && <span className="text-muted-foreground" style={{ fontSize: 12 }}>{draft.length} lines</span>}
                </div>
                <FclLinesGrid lines={draft} defaultCurrency={defaultCurrency} onChange={setDraft} />
              </section>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '12px 20px', borderTop: '1px solid var(--color-line)' }}>
              <button type="button" className="btn btn--inline" style={{ marginTop: 0, background: 'transparent', color: 'var(--color-ink)', border: '1px solid var(--color-line)' }} onClick={() => !busy && setOpen(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn--inline" style={{ marginTop: 0 }} onClick={save} disabled={busy}>{saving ? 'Saving…' : 'Save lines'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
