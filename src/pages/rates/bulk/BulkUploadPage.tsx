import { useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileSpreadsheet, Play } from 'lucide-react'
import { toast } from 'sonner'
import { useCoLoaders, useCurrencies, useShippingLines } from '@/hooks/useQuoteRefData'
import BulkJobRow from './BulkJobRow'
import { defaultSheetSel, guessCarrier, guessKind, pickSheet, processJob, readWorkbook, type BulkJob } from './bulkImport'

const PARALLEL = 2
const lbl = { fontSize: 12, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 } as const

/** Setup > Rates > Bulk Excel upload: many carrier files in, one draft card per file out. */
export default function BulkUploadPage() {
  const [jobs, setJobs] = useState<BulkJob[]>([])
  const [running, setRunning] = useState(false)
  const [drag, setDrag] = useState(false)
  const [currency, setCurrency] = useState('USD')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const jobsRef = useRef<BulkJob[]>([])
  const { items: lines } = useShippingLines()
  const { items: coLoaders } = useCoLoaders()
  const { items: currencies } = useCurrencies()

  const update = (id: string, p: Partial<BulkJob>) =>
    setJobs((js) => { const next = js.map((j) => (j.id === id ? { ...j, ...p } : j)); jobsRef.current = next; return next })

  async function addFiles(files: FileList | File[]) {
    const list = [...files].filter((f) => /\.xlsx?$/i.test(f.name))
    if (!list.length) { toast.error('Excel files only (.xlsx, .xls)'); return }
    const added: BulkJob[] = []
    for (const f of list) {
      try {
        const sheets = await readWorkbook(f)
        const kind = guessKind(f.name, sheets.map((s) => s.name))
        const carrier = kind === 'fcl' ? guessCarrier(f.name, lines) : kind === 'lcl' ? guessCarrier(f.name, coLoaders) : null
        added.push({
          id: crypto.randomUUID(), file: f.name, sheets, sheet: pickSheet(kind, sheets.filter((s) => !s.hidden).map((s) => s.name)), sheetSel: defaultSheetSel(sheets), kind,
          carrier: carrier?.code ?? '', carrierName: carrier?.name ?? '', currency, sellRates: false,
          title: f.name.replace(/\.xlsx?$/i, '').replace(/[_]+/g, ' ').trim(), validFrom, validTo, status: 'ready',
        })
      } catch {
        toast.error(`Could not read ${f.name}`)
      }
    }
    setJobs((js) => { const next = [...js, ...added]; jobsRef.current = next; return next })
  }

  async function runAll(only?: string) {
    const queue = jobsRef.current.filter((j) => (only ? j.id === only : j.status === 'ready' || j.status === 'failed'))
    const missing = queue.filter((j) => !j.carrier && j.kind !== 'fcl')
    if (missing.length) { toast.error(`Pick a carrier for: ${missing.map((j) => j.file).join(', ')}`); return }
    if (!queue.length) return
    setRunning(true)
    const known = new Set(lines.map((l) => l.code))
    let i = 0
    const worker = async () => {
      while (i < queue.length) {
        const j = queue[i++]
        await processJob(j, (p) => update(j.id, p), known)
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker))
    setRunning(false)
    const all = jobsRef.current
    const ok = all.filter((j) => j.status === 'done').length
    const bad = all.filter((j) => j.status === 'failed').length
    toast[bad ? 'warning' : 'success'](`${ok} card${ok === 1 ? '' : 's'} created as draft${bad ? `, ${bad} failed` : ''}`)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault(); setDrag(false)
    if (!running && e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files)
  }

  const pending = jobs.filter((j) => j.status === 'ready' || j.status === 'failed').length

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <div>
            <Link to="/setup/rates" className="text-muted-foreground" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}><ArrowLeft size={14} /> Rates</Link>
            <h1 style={{ marginTop: 4 }}>Bulk Excel upload</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--muted-foreground)', fontSize: 14, maxWidth: 760 }}>
              Drop several carrier rate sheets. Each file becomes a <b>draft</b> rate card, read by AI. Nothing goes live until you open
              the card, check the amber and red lines, and set status to Validated or Active.
            </p>
          </div>
        </header>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginTop: 16 }}>
          <label onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
            style={{ flex: '1 1 360px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 84, borderRadius: 10, cursor: running ? 'not-allowed' : 'pointer',
              border: `2px dashed ${drag ? '#0A2472' : 'var(--color-line)'}`, background: drag ? '#EAEDF6' : '#fff', color: '#0A2472', fontSize: 14 }}>
            <FileSpreadsheet size={20} /> Drop Excel files here or click to choose
            <input type="file" accept=".xlsx,.xls" multiple disabled={running} style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = '' }} />
          </label>
          <div>
            <span style={lbl}>Default currency</span>
            <select className="input input--sm" style={{ width: 'auto' }} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
          <div><span style={lbl}>Valid from</span><input type="date" className="input input--sm" style={{ width: 'auto' }} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></div>
          <div><span style={lbl}>Valid to</span><input type="date" className="input input--sm" style={{ width: 'auto' }} value={validTo} onChange={(e) => setValidTo(e.target.value)} /></div>
        </div>
        <p className="text-muted-foreground" style={{ fontSize: 12, margin: '6px 0 0' }}>Defaults apply to files added after you set them. Each row can be changed before processing.</p>

        {jobs.length > 0 && (
          <>
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="data-table">
                <thead><tr><th>File / sheet</th><th>Type</th><th>Carrier</th><th>Currency</th><th>Rates are</th><th>Card title</th><th>Result</th><th /></tr></thead>
                <tbody>
                  {jobs.map((j) => (
                    <BulkJobRow key={j.id} job={j} lines={lines} coLoaders={coLoaders} currencies={currencies} locked={running}
                      onChange={(p) => update(j.id, p)}
                      onRemove={() => setJobs((js) => { const next = js.filter((x) => x.id !== j.id); jobsRef.current = next; return next })}
                      onRetry={() => void runAll(j.id)} />
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <span className="text-muted-foreground" style={{ fontSize: 13 }}>FCL reads every ticked sheet, about 1 to 3 minutes per file. Keep this page open.</span>
              <button type="button" className="btn" disabled={running || pending === 0} onClick={() => void runAll()}>
                <Play size={14} /> {running ? 'Processing' : `Process ${pending} file${pending === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
