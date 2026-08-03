import { useState, type ChangeEvent } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet } from 'lucide-react'

type Parsed = { sheetName: string; rows: string[][]; totalRows: number }

export default function FclExcelImport() {
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [err, setErr] = useState('')
  const [fileName, setFileName] = useState('')

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setErr(''); setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheetName = wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })
      setParsed({ sheetName, rows: rows.slice(0, 30), totalRows: rows.length })
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not read file')
      setParsed(null)
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

      {err && <p style={{ color: '#B23B3B', fontSize: 13, marginTop: 10 }}>{err}</p>}

      {parsed && (
        <div style={{ marginTop: 12 }}>
          <p className="text-muted-foreground" style={{ fontSize: 12, margin: '0 0 8px' }}>
            Sheet “{parsed.sheetName}” · {parsed.totalRows} rows (showing first {parsed.rows.length})
          </p>
          <div className="table-wrap" style={{ maxHeight: 360, overflow: 'auto' }}>
            <table className="data-table">
              <tbody>
                {parsed.rows.map((r, ri) => (
                  <tr key={ri}>
                    {Array.from({ length: maxCols }).map((_, ci) => (
                      <td key={ci} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{r[ci] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
