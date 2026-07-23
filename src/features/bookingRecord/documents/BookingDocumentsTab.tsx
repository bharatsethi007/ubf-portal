import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import DocumentPreviewDialog from './DocumentPreviewDialog'
import DocumentsByTagList, { UploadProgressList } from './DocumentsByTagList'
import DocumentUploadConfirm from './DocumentUploadConfirm'
import DocumentUploadZone from './DocumentUploadZone'
import { useBookingRecordDocuments } from './useBookingRecordDocuments'
import type { BookingDocumentRow } from './documentTypes'

type Props = {
  bookingId: string
  accountId: string | null
}

export default function BookingDocumentsTab({ bookingId, accountId }: Props) {
  const {
    documents,
    tags,
    loading,
    pending,
    confirmOpen,
    progress,
    setConfirmOpen,
    setPending,
    queueFiles,
    confirmUploads,
    setPendingTag,
    addTag,
    changeTag,
    remove,
    getSignedUrl,
    download,
  } = useBookingRecordDocuments(bookingId, accountId)

  const [dragOver, setDragOver] = useState(false)
  const [tabDrag, setTabDrag] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<BookingDocumentRow | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleFiles = useCallback((files: FileList | File[]) => {
    setTabDrag(false)
    setDragOver(false)
    queueFiles(files)
  }, [queueFiles])

  const handleTabDrop = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.files.length) return
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  async function openPreview(doc: BookingDocumentRow) {
    try {
      const url = await getSignedUrl(doc)
      setPreviewDoc(doc)
      setPreviewUrl(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load preview')
    }
  }

  return (
    <div
      className={`booking-docs-tab${tabDrag ? ' booking-docs-tab--drag' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setTabDrag(true)
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setTabDrag(false)
      }}
      onDrop={handleTabDrop}
    >
      <DocumentUploadZone
        dragOver={dragOver || tabDrag}
        onDragOver={setDragOver}
        onFiles={handleFiles}
      />

      <UploadProgressList rows={progress} />

      {loading ? (
        <p className="muted pad-inline">Loading documents…</p>
      ) : (
        <DocumentsByTagList
          documents={documents}
          tags={tags}
          onPreview={(doc) => void openPreview(doc)}
          onDownload={download}
          onDelete={remove}
          onTagChange={changeTag}
          onCreateTag={addTag}
        />
      )}

      <DocumentUploadConfirm
        open={confirmOpen}
        pending={pending}
        tags={tags}
        onClose={() => {
          setConfirmOpen(false)
          setPending([])
        }}
        onConfirm={() => void confirmUploads()}
        onTagChange={setPendingTag}
        onCreateTag={addTag}
      />

      <DocumentPreviewDialog
        doc={previewDoc}
        previewUrl={previewUrl}
        onClose={() => {
          setPreviewDoc(null)
          setPreviewUrl(null)
        }}
      />
    </div>
  )
}
