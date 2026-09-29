import { useRef, useState } from 'react'
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react'
import { importRows } from './productsApi'
import { LABELS, REQUIRED, downloadTemplate, parseSheet, type Kind, type Parsed } from './sheetImport'

type Props = { onDone: () => void; onClose: () => void; initial?: Kind }

/** Excel / CSV upload for products or PO lines, with column auto-matching and a preview. */
export default function UploadPanel({ onDone, onClose, initial = 'po' }: Props) {
  const [kind, setKind] = useState<Kind>(initial)
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function pick(f: File | undefined, k = kind) {
    if (!f) return
    setFile(f); setErr(''); setResult(null); setParsed(null)
    try { setParsed(await parseSheet(f, k)) } catch { setErr('Could not read that file. Use .xlsx or .csv.') }
  }

  async function run() {
    if (!parsed?.rows.length) return
    setBusy(true); setErr('')
    try {
      const r = await importRows(kind, parsed.rows)
      setResult(kind === 'products'
        ? `${r.added ?? 0} products added, ${r.updated ?? 0} updated.`
        : `${r.lines ?? 0} lines across ${r.pos ?? 0} purchase orders${r.new_products ? `, ${r.new_products} new SKUs added to your catalogue` : ''}.`)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed')
    } finally { setBusy(false) }
  }

  const fields = Object.keys(parsed?.mapped ?? {})
  return (
    <section className="pv3-card pv3-form pv3-up pv3-rise" aria-label="Upload">
      <header className="pv3-quote__head">
        <h2>Upload {kind === 'po' ? 'purchase orders' : 'products'}</h2>
        <button type="button" className="pv3-iconbtn" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </header>
      <div className="pv3-up__row">
        <div className="pv3-seg pv3-seg--form" role="group" aria-label="What are you uploading">
          <button type="button" className={kind === 'po' ? 'pv3-seg__on' : ''} onClick={() => { setKind('po'); if (file) void pick(file, 'po') }}>Purchase order lines</button>
          <button type="button" className={kind === 'products' ? 'pv3-seg__on' : ''} onClick={() => { setKind('products'); if (file) void pick(file, 'products') }}>Product catalogue</button>
        </div>
        <button type="button" className="pv3-textbtn" onClick={() => void downloadTemplate(kind)}><Download size={14} /> Download template</button>
      </div>
      <p className="pv3-muted">
        {kind === 'po'
          ? 'One row per PO line: PO number, SKU and quantity are needed. Supplier, dates and unit price help us show lead times and landed cost. Re-uploading a PO updates it.'
          : 'One row per SKU. Description, supplier, HS code, unit value and weight make tracking and cost insights richer.'}
      </p>

      <label className={`pv3-up__drop${file ? ' pv3-up__drop--has' : ''}`}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files[0]) }}>
        <input ref={input} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => void pick(e.target.files?.[0])} />
        {file ? <FileSpreadsheet size={22} /> : <Upload size={22} />}
        <span>{file ? file.name : 'Drop an Excel or CSV file here, or click to choose'}</span>
      </label>

      {parsed && (
        <div className="pv3-up__preview">
          <div className="pv3-up__map">
            {Object.keys(LABELS).filter((f) => f in parsed.mapped || REQUIRED[kind].includes(f)).map((f) => (
              <span key={f} className={parsed.mapped[f] ? 'pv3-up__ok' : 'pv3-up__miss'}>
                {LABELS[f]}{parsed.mapped[f] ? ` ← ${parsed.mapped[f]}` : ' not found'}
              </span>
            ))}
          </div>
          {parsed.missing.length ? (
            <div className="pv3-form__err">Add a column for {parsed.missing.map((m) => LABELS[m]).join(', ')} and upload again, or use the template.</div>
          ) : (
            <>
              <div className="pv3-table-wrap">
                <table className="pv3-table">
                  <thead><tr>{fields.map((f) => <th key={f}>{LABELS[f]}</th>)}</tr></thead>
                  <tbody>{parsed.rows.slice(0, 5).map((r, i) => <tr key={i} className="pv3-an__static">{fields.map((f) => <td key={f}>{String(r[f] ?? '')}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <span className="pv3-muted">{parsed.rows.length} usable rows of {parsed.total}{parsed.total > parsed.rows.length ? ' (rows without the required fields are skipped)' : ''}.</span>
            </>
          )}
        </div>
      )}

      {err && <div className="pv3-form__err" role="alert">{err}</div>}
      {result && <div className="pv3-up__done"><CheckCircle2 size={18} /> {result}</div>}

      <div className="pv3-form__submit">
        <button type="button" className="pv3-btn pv3-btn--primary" disabled={busy || !parsed?.rows.length || parsed.missing.length > 0} onClick={() => void run()}>
          {busy && <Loader2 size={14} className="pv3-spin" />} Import {parsed?.rows.length ? parsed.rows.length : ''} rows
        </button>
      </div>
    </section>
  )
}
