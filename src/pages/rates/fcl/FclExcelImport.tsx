import { useState, type ChangeEvent } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, X, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../../supabase'
import FclLinesGrid from './FclLinesGrid'
import { saveFclLines, type FclLineDraft } from '../ratesApi'

type Parsed = { sheetName: string; rows: string[][]; totalRows: number }

type Props = { cardId: string; defaultCurrency: string; onImported: () => void }

export default function FclExcelImport({ cardId, defaultCurrency, onImported }: Props) {
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [allRows, setAllRows] = useState<string[][]>([])
  const [fileName, setFileName] = useState('')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FclLineDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [parsing, setParsing] = useState(false)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheetName = wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })
      setAllRows(rows)
      setParsed({ sheetName, rows: rows.slice(0, 100), totalRows: rows.length })
      setDraft([])
      setOpen(true)
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : 'Could not read file')
    }
  }

  async function parseWithAI() {
    if (parsing) return
    setParsing(true)
    try {
      const { data, error } = await supabase.functions.invoke('rate-card-parse', {
        body: { rate_card_id: cardId, sheet: allRows },
      })
      if (error) throw new Error(error.message || 'Parse failed')
      if (data?.error) throw new Error(data.error)
      const lines: any[] = Array.isArray(data?.lines) ? data.lines : []
      const drafts: FclLineDraft[] = lines.map((l, i) => ({
        key: `ai-${i}`,
        dbId: null,
        origin_port_code: l.origin_port_code || '',
        dest_port_code: l.dest_port_code || '',
        container_type: l.container_type || '',
        base_rate: l.base_rate != null ? String(l.base_rate) : '',
        currency_code: l.currency_code || defaultCurrency || '',
        transit_days: l.transit_days != null ? String(l.transit_days) : '',
        via: l.via || '',
      }))
      setDraft(drafts)
      toast.success(`Parsed ${drafts.length} line${drafts.length === 1 ? '' : 's'} — review before saving`)
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : 'Parse failed')
    } finally {
      setParsing(false)
    }
  }

  async function save() {
    if (saving) return
    if (draft.length === 0) { toast.error('Nothing to import'); return }
    for (const l of draft) {
      if (!l.dest_port_code || !l.container_type || l.base_rate === '' || isNaN(Number(l.base_rate))) {
        toast.error('Each line needs a destination, container, and numeric base rate')
        return
      }
    }
    setSaving(true)
    try {
      await saveFclLines(cardId, draft, [])
      toast.success(`Imported ${draft.length} line${draft.length === 1 ? '' : 's'}`)
      setOpen(false)
      onImported()
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : 'Import failed')
    } finally {
      setSaving(false)
    }
  }

  const maxCols = parsed ? parsed.rows.reduce((m, r) => Math.max(m, r.length), 0) : 0

  return (
    <div>
      <label className="btn btn--inline" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', width: 'auto' }}>
        <FileSpreadsheet size={15} /> Choose Excel file
        <input type="file" accept=".xlsx,.xls" onChange={onFile} style={{ display: 'none' }} />
      </label>
      {fileName && <span className="text-muted-foreground" style={{ fontSize: 12, marginLeft: 12 }}>{fileName}</span>}

      {open && parsed && (
        <div role="dialog" aria-modal="true"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !saving && !parsing) setOpen(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '5vh 5vw' }}>
          <div style={{ width: '90vw', height: '90vh', maxWidth: 1600, background: '#fff', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--color-line)' }}>
              <div>
                <h2 style={{ fontSize: 16, margin: 0 }}>Import from Excel</h2>
                <p className="text-muted-foreground" style={{ fontSize: 12, margin: '2px 0 0' }}>{fileName} · sheet “{parsed.sheetName}” · {parsed.totalRows} rows</p>
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
                      {parsed.rows.map((r, ri) => (
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
                <FclLinesGrid lines={draft} defaultCurrency={defaultCurrency} onChange={setDraft} />
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
