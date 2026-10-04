import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Loader2, Plus } from 'lucide-react'
import { formatShortDate } from '../../dashboard/portalFormat'
import {
  listPortalDocuments,
  portalDocumentUrl,
  uploadPortalDocument,
  type PortalDocument,
} from '../portalDocumentsApi'

type Props = { bookingId?: string | null }

function size(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: 8, border: '1px solid var(--pv3-border, #e2e8f0)',
  background: 'transparent', cursor: 'pointer',
}

export default function DocumentsTab({ bookingId }: Props) {
  const [docs, setDocs] = useState<PortalDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!bookingId) { setLoading(false); return }
    setLoading(true)
    try { setDocs(await listPortalDocuments(bookingId)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load documents') }
    finally { setLoading(false) }
  }, [bookingId])

  useEffect(() => { void load() }, [load])

  async function onFiles(files: FileList | null) {
    if (!bookingId || !files?.length) return
    setUploading(true)
    setError(null)
    try {
      for (const f of Array.from(files)) {
        const doc = await uploadPortalDocument(bookingId, f)
        setDocs((prev) => [doc, ...prev])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  async function open(doc: PortalDocument, download: boolean) {
    try { window.open(await portalDocumentUrl(doc, download), '_blank', 'noopener,noreferrer') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open file') }
  }

  if (!bookingId) {
    return (
      <div className="portal-detail-empty">
        <p className="portal-empty">No documents yet.</p>
        <p className="portal-detail-muted">Documents appear here once this shipment is linked to your booking with UB Freight.</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button type="button" style={iconBtn} title="Upload documents" aria-label="Upload documents"
          disabled={uploading} onClick={() => input.current?.click()}>
          {uploading ? <Loader2 size={16} className="bf-docs__spin" /> : <Plus size={16} />}
        </button>
        <span className="portal-detail-muted">Upload invoices, packing lists or permits. UB Freight sees them straight away.</span>
        <input ref={input} type="file" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
      </div>

      {error && <p className="portal-detail-muted" style={{ color: '#b91c1c' }}>{error}</p>}

      {loading ? (
        <p className="portal-empty">Loading documents…</p>
      ) : !docs.length ? (
        <p className="portal-empty">No documents shared yet.</p>
      ) : (
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>File</th><th>From</th><th>Size</th><th>Added</th><th aria-label="Download" />
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>
                    <button type="button" className="pv3-link" onClick={() => void open(d, false)}
                      style={{ border: 0, background: 'none', padding: 0, font: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                      {d.file_name}
                    </button>
                  </td>
                  <td>{d.uploaded_via === 'customer' ? 'You' : 'UB Freight'}</td>
                  <td className="nums">{size(d.size_bytes)}</td>
                  <td className="nums">{formatShortDate(d.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" style={iconBtn} title="Download" aria-label="Download" onClick={() => void open(d, true)}>
                      <Download size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
