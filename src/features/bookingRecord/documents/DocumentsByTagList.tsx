import { Download, Eye, EyeOff, Loader2, Trash2, UserRound } from 'lucide-react'
import { formatFileSize } from '@/components/bookings/bookingDocumentsApi'
import { fmtDate } from '@/utils/format'
import DocumentTagMenu from './DocumentTagMenu'
import type { BookingDocumentRow, DocumentTag } from './documentTypes'
import { isPreviewable } from './documentTypes'

type Props = {
  documents: BookingDocumentRow[]
  tags: DocumentTag[]
  onPreview: (doc: BookingDocumentRow) => void
  onDownload: (doc: BookingDocumentRow) => void
  onDelete: (doc: BookingDocumentRow) => void
  onTagChange: (doc: BookingDocumentRow, tagId: string | null) => void
  onToggleShare: (doc: BookingDocumentRow) => void
  onCreateTag: (name: string) => Promise<DocumentTag>
}

function groupByTag(docs: BookingDocumentRow[], tags: DocumentTag[]) {
  const groups = new Map<string, { title: string; docs: BookingDocumentRow[] }>()

  for (const tag of tags) groups.set(tag.id, { title: tag.name, docs: [] })
  groups.set('untagged', { title: 'Untagged', docs: [] })

  for (const doc of docs) {
    const key = doc.tag_id ?? 'untagged'
    if (!groups.has(key)) groups.set(key, { title: doc.tag_name ?? 'Untagged', docs: [] })
    groups.get(key)!.docs.push(doc)
  }

  return [...groups.values()].filter((g) => g.docs.length > 0)
}

export default function DocumentsByTagList({
  documents,
  tags,
  onPreview,
  onDownload,
  onDelete,
  onTagChange,
  onToggleShare,
  onCreateTag,
}: Props) {
  const groups = groupByTag(documents, tags)

  if (groups.length === 0) {
    return <p className="muted pad-inline">No documents yet. Drop files above to upload.</p>
  }

  return (
    <div className="booking-docs-groups">
      {groups.map((group) => (
        <section key={group.title} className="card booking-docs-group">
          <h3 className="booking-docs-group__title">{group.title}</h3>
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Tag</th>
                  <th>Size</th>
                  <th>Uploaded by</th>
                  <th>Uploaded</th>
                  <th>Customer</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {group.docs.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <button
                        type="button"
                        className="link booking-docs-file"
                        onClick={() => {
                          if (isPreviewable(doc.mime_type, doc.file_name)) onPreview(doc)
                          else void onDownload(doc)
                        }}
                      >
                        {doc.file_name}
                      </button>
                    </td>
                    <td>
                      <DocumentTagMenu
                        tags={tags}
                        value={doc.tag_id}
                        onChange={(tagId) => onTagChange(doc, tagId)}
                        onCreateTag={onCreateTag}
                        compact
                      />
                    </td>
                    <td className="mono">{formatFileSize(doc.size_bytes)}</td>
                    <td>{doc.uploader_email ?? '—'}</td>
                    <td className="mono">{doc.created_at ? fmtDate(doc.created_at, true) : '—'}</td>
                    <td><ShareCell doc={doc} onToggle={onToggleShare} /></td>
                    <td>
                      <div className="booking-docs-actions">
                        <button type="button" className="icon-btn" aria-label="Download" onClick={() => void onDownload(doc)}>
                          <Download size={14} />
                        </button>
                        <button type="button" className="icon-btn" aria-label="Delete" onClick={() => void onDelete(doc)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}

/** Customer column: customer uploads show a fixed badge; staff docs get a share toggle. */
function ShareCell({ doc, onToggle }: { doc: BookingDocumentRow; onToggle: (doc: BookingDocumentRow) => void }) {
  if (doc.uploaded_via === 'customer') {
    return (
      <span className="portal-pill" title="Uploaded by the customer. Always visible to them."
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#eef2ff', color: '#0A2472' }}>
        <UserRound size={12} /> From customer
      </span>
    )
  }
  const shared = doc.customer_visible
  const label = shared ? 'Shared with customer. Click to hide.' : 'Hidden from customer. Click to share.'
  return (
    <button
      type="button"
      className="icon-btn"
      title={label}
      aria-label={label}
      aria-pressed={shared}
      onClick={() => onToggle(doc)}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: shared ? '#16a34a' : '#94a3b8' }}
    >
      {shared ? <Eye size={14} /> : <EyeOff size={14} />}
    </button>
  )
}

export function UploadProgressList({ rows }: { rows: { key: string; name: string; status: string; error?: string }[] }) {
  if (!rows.length) return null
  return (
    <div className="booking-docs-progress">
      {rows.map((row) => (
        <div key={row.key} className="bf-docs__item bf-docs__item--progress">
          {row.status === 'uploading' ? <Loader2 size={14} className="bf-docs__spin" /> : null}
          <span>{row.name}</span>
          {row.status === 'error' ? <span className="bf-field__error">{row.error}</span> : null}
        </div>
      ))}
    </div>
  )
}
