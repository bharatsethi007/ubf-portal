import { useState, type ChangeEvent } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, X, Sparkles, Save } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../../supabase'
import type { CartageZone, CartageBand } from '../../cartage/cartageApi'
import CartageFclLinesGrid from './CartageFclLinesGrid'
import CartageLtlLanesGrid from './CartageLtlLanesGrid'
import {
  insertCartageFclLines, insertCartageLtlLanes, learnCartageAliases,
  type CartageFclLineDraft, type CartageLtlLaneDraft,
} from './cartageRatesApi'

type SheetData = { name: string; rows: string[][] }
type Props = { cardId: string; zones: CartageZone[]; bands: CartageBand[]; onImported: () => void }

function pickDefaultSheet(names: string[]): string {
  const score = (n: string) => {
    const s = n.toLowerCase(); let v = 0
    if (/cartage|rate|tariff|freight|zone/.test(s)) v += 2
    if (/note|term|condition|contact|legend|instruction/.test(s)) v -= 2
    return v
  }
  return [...names].sort((a, b) => score(b) - score(a))[0] ?? names[0]
}

export default function CartageExcelImport({ cardId, zones, bands, onImported }: Props) {
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [fileName, setFileName] = useState('')
  const [open, setOpen] = useState(false)
  const [fclDraft, setFclDraft] = useState<CartageFclLineDraft[]>([])
  const [ltlDraft, setLtlDraft] = useState<CartageLtlLaneDraft[]>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)

  const current = sheets.find((s) => s.name === selectedSheet)
  const busy = parsing || saving
  const zoneById = new Map(zones.map((z) => [z.id, z]))

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
      setFclDraft([]); setLtlDraft([]); setOpen(true)
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : 'Could not read file')
    }
  }

  async function parseWithAI() {
    if (parsing || !current) return
    setParsing(true)
    try {
      const { data, error } = await supabase.functions.invoke('rate-card-parse-cartage', {
        body: { rate_card_id: cardId, sheet: current.rows },
      })
      if (error) throw new Error(error.message || 'Parse failed')
      if (data?.error) throw new Error(data.error)
      const fcl: any[] = Array.isArray(data?.fcl_lines) ? data.fcl_lines : []
      const ltl: any[] = Array.isArray(data?.ltl_lanes) ? data.ltl_lanes : []
      setFclDraft(fcl.map((l, i) => ({
        key: `ai-fcl-${i}`, dbId: null,
        direction: l.direction === 'import' ? 'import' : 'export',
        origin_zone_id: l.origin_zone_id || '', dest_zone_id: l.dest_zone_id || '',
        container_size: l.container_size === '20' || l.container_size === '40' ? l.container_size : '',
        base_rate: l.base_rate != null ? String(l.base_rate) : '',
        min_charge: l.min_charge != null ? String(l.min_charge) : '',
        confidence: l.confidence === 'amber' || l.confidence === 'red' ? l.confidence : 'green',
        raw_origin: l.raw_origin || '', raw_dest: l.raw_dest || '', note: l.note || '',
      })))
      setLtlDraft(ltl.map((l, i) => {
        const br: Record<string, string> = {}
        for (const b of (Array.isArray(l.band_rates) ? l.band_rates : [])) {
          if (b?.band_id != null) br[String(b.band_id)] = b.per_kg != null ? String(b.per_kg) : ''
        }
        return {
          key: `ai-ltl-${i}`, dbId: null,
          direction: l.direction === 'import' ? 'import' : 'export',
          origin_zone_id: l.origin_zone_id || '', dest_zone_id: l.dest_zone_id || '',
          min_charge: l.min_charge != null ? String(l.min_charge) : '',
          per_cbm: l.per_cbm != null ? String(l.per_cbm) : '',
          band_rates: br,
          confidence: l.confidence === 'amber' || l.confidence === 'red' ? l.confidence : 'green',
          raw_origin: l.raw_origin || '', raw_dest: l.raw_dest || '', note: l.note || '',
        } as CartageLtlLaneDraft
      }))
      toast.success(`Parsed ${fcl.length} FCL + ${ltl.length} LTL — review the red/amber rows before saving`)
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : 'Parse failed')
    } finally { setParsing(false) }
  }

  // Learn raw->zone from any row the human left resolved, where the sheet text differs from the zone's own code/name.
  function aliasPairs(): { raw: string; zone_id: string }[] {
    const out: { raw: string; zone_id: string }[] = []
    const add = (raw: string | undefined, zid: string) => {
      const z = zoneById.get(zid); if (!raw || !z) return
      const r = raw.trim().toLowerCase()
      if (!r || r === z.zone_code.toLowerCase() || r === z.name.toLowerCase()) return
      out.push({ raw: raw.trim(), zone_id: zid })
    }
    for (const l of fclDraft) { add(l.raw_origin, l.origin_zone_id); add(l.raw_dest, l.dest_zone_id) }
    for (const l of ltlDraft) { add(l.raw_origin, l.origin_zone_id); add(l.raw_dest, l.dest_zone_id) }
    return out
  }

  async function save() {
    if (saving) return
    if (fclDraft.length === 0 && ltlDraft.length === 0) { toast.error('Nothing to import'); return }
    const badFcl = fclDraft.filter((l) => !l.origin_zone_id || !l.dest_zone_id || !l.container_size || l.base_rate === '' || isNaN(Number(l.base_rate)))
    const badLtl = ltlDraft.filter((l) => {
      const hasBand = Object.values(l.band_rates).some((v) => v !== '' && !isNaN(Number(v)))
      const hasCbm = l.per_cbm !== '' && !isNaN(Number(l.per_cbm))
      return !l.origin_zone_id || !l.dest_zone_id || (!hasBand && !hasCbm)
    })
    if (badFcl.length || badLtl.length) {
      toast.error(`Fix the "—" rows first: ${badFcl.length} FCL and ${badLtl.length} LTL still need zones and a rate`)
      return
    }
    setSaving(true)
    try {
      const nF = await insertCartageFclLines(cardId, fclDraft)
      const nL = await insertCartageLtlLanes(cardId, ltlDraft)
      toast.success(`Imported ${nF} FCL line${nF === 1 ? '' : 's'} + ${nL} LTL lane${nL === 1 ? '' : 's'}`)
      try {
        const learned = await learnCartageAliases(aliasPairs())
        if (learned > 0) toast.success(`Learned ${learned} new zone alias${learned === 1 ? '' : 'es'}`)
      } catch { /* non-fatal */ }
      setOpen(false)
      onImported()
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : 'Import failed')
    } finally { setSaving(false) }
  }

  const previewRows = current ? current.rows.slice(0, 100) : []
  const maxCols = previewRows.reduce((m, r) => Math.max(m, r.length), 0)

  return (
    <div>
      <label className="btn btn--inline" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', width: 'auto', marginTop: 0 }}>
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
                  <h2 style={{ fontSize: 16, margin: 0 }}>Import cartage rates from Excel</h2>
                  <p className="text-muted-foreground" style={{ fontSize: 12, margin: '2px 0 0' }}>{fileName} · {current.rows.length} rows</p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <span className="text-muted-foreground">Sheet</span>
                  <select className="input input--sm" value={selectedSheet} disabled={busy} onChange={(e) => { setSelectedSheet(e.target.value); setFclDraft([]); setLtlDraft([]) }}>
                    {sheets.map((s) => (<option key={s.name} value={s.name}>{s.name}</option>))}
                  </select>
                </label>
                <button type="button" className="btn btn--inline" style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={parseWithAI} disabled={busy}>
                  <Sparkles size={14} /> {parsing ? 'Parsing…' : 'Parse with AI'}
                </button>
              </div>
              <button type="button" aria-label="Close" onClick={() => !busy && setOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4 }}><X size={20} /></button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <section>
                <h3 style={{ fontSize: 13, margin: '0 0 8px', color: 'var(--muted-foreground)' }}>Source sheet (reference)</h3>
                <div className="table-wrap" style={{ maxHeight: 200, overflow: 'auto' }}>
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
                <h3 style={{ fontSize: 13, margin: '0 0 8px', color: 'var(--muted-foreground)' }}>FCL lines to import ({fclDraft.length})</h3>
                <CartageFclLinesGrid lines={fclDraft} zones={zones} onChange={setFclDraft} />
              </section>

              <section>
                <h3 style={{ fontSize: 13, margin: '0 0 8px', color: 'var(--muted-foreground)' }}>LTL lanes to import ({ltlDraft.length})</h3>
                <CartageLtlLanesGrid lanes={ltlDraft} zones={zones} bands={bands} onChange={setLtlDraft} />
              </section>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '12px 20px', borderTop: '1px solid var(--color-line)' }}>
              <button type="button" className="text-link" onClick={() => !busy && setOpen(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn--inline" title="Save import" aria-label="Save import" style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={save} disabled={busy}>
                <Save size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
