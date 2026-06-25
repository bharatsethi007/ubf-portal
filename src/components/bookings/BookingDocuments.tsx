import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Loader2, X } from 'lucide-react'
import type { BookingDocument } from '../../types/bookingDocument'
import {
  deleteBookingDocument,
  formatFileSize,
  loadBookingDocuments,
  signedDownloadUrl,
  uploadBookingFile,
} from './bookingDocumentsApi'
import './bookingDocuments.css'

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/*'

type UploadRow = {
  key: string
  name: string
  status: 'uploading' | 'error'
  error?: string
}

export type BookingDocumentsHandle = {
  flushPending: (bookingId: string) => Promise<void>
  pendingCount: () => number
}

type Props = {
  bookingId?: string
  accountId?: string
  initialDocuments?: BookingDocument[]
}

const BookingDocuments = forwardRef<BookingDocumentsHandle, Props>(function BookingDocuments(
  { bookingId, accountId, initialDocuments = [] },
  ref,
) {
  const [documents, setDocuments] = useState<BookingDocument[]>(initialDocuments)
  const [pending, setPending] = useState<File[]>([])
  const [uploading, setUploading] = useState<UploadRow[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [toast, setToast] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const accountFolder = accountId?.trim() || 'unassigned'

  useEffect(() => {
    setDocuments(initialDocuments)
  }, [initialDocuments])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(''), 4000)
    return () => window.clearTimeout(t)
  }, [toast])

  const showError = useCallback((msg: string) => setToast(msg), [])

  const uploadOne = useCallback(async (file: File, id: string) => {
    const doc = await uploadBookingFile(file, id, accountFolder)
    setDocuments((prev) => [doc, ...prev])
  }, [accountFolder])

  const processFiles = useCallback(async (files: FileList | File[], id: string) => {
    for (const file of Array.from(files)) {
      const key = `${file.name}-${Date.now()}`
      setUploading((u) => [...u, { key, name: file.name, status: 'uploading' }])
      try {
        await uploadOne(file, id)
        setUploading((u) => u.filter((row) => row.key !== key))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        setUploading((u) => u.map((row) => (row.key === key ? { ...row, status: 'error', error: message } : row)))
        showError(message)
      }
    }
  }, [showError, uploadOne])

  const flushPending = useCallback(async (id: string) => {
    if (!pending.length) return
    const batch = [...pending]
    setPending([])
    await processFiles(batch, id)
  }, [pending, processFiles])

  useImperativeHandle(ref, () => ({
    flushPending,
    pendingCount: () => pending.length,
  }), [flushPending, pending.length])

  function onPick(files: FileList | null) {
    if (!files?.length) return
    if (!bookingId) {
      setPending((p) => [...p, ...Array.from(files)])
      return
    }
    void processFiles(files, bookingId)
  }

  async function onDelete(doc: BookingDocument) {
    try {
      await deleteBookingDocument(doc)
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  async function onDownload(doc: BookingDocument) {
    try {
      const url = await signedDownloadUrl(doc.storage_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Download failed')
    }
  }

  const canUpload = Boolean(bookingId)
  const hint = canUpload
    ? 'Drag files here or click to browse'
    : pending.length
      ? `${pending.length} file(s) ready — save draft to upload`
      : 'Save the booking to attach documents'

  return (
    <div className="bf-docs">
      {toast && <div className="bf-docs__toast" role="status">{toast}</div>}
      <div
        className={`bf-docs__drop${dragOver ? ' bf-docs__drop--over' : ''}${!canUpload && !pending.length ? ' bf-docs__drop--muted' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          onPick(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        role="button"
        tabIndex={0}
      >
        <input ref={inputRef} type="file" className="bf-docs__input" multiple accept={ACCEPT} onChange={(e) => onPick(e.target.files)} />
        <p className="bf-docs__drop-text">{hint}</p>
        <p className="bf-docs__drop-hint muted">PDF, images, Word, Excel</p>
      </div>

      {pending.length > 0 && !bookingId && (
        <ul className="bf-docs__list">
          {pending.map((f, i) => (
            <li key={`${f.name}-${i}`} className="bf-docs__item">
              <span className="bf-docs__name">{f.name}</span>
              <span className="bf-docs__meta muted">{formatFileSize(f.size)} · pending</span>
              <button type="button" className="bf-docs__remove" onClick={() => setPending((p) => p.filter((_, j) => j !== i))} aria-label="Remove">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {uploading.map((row) => (
        <div key={row.key} className="bf-docs__item bf-docs__item--progress">
          <Loader2 size={14} className="bf-docs__spin" />
          <span>{row.name}</span>
          {row.status === 'error' && <span className="bf-field__error">{row.error}</span>}
        </div>
      ))}

      {documents.length > 0 && (
        <ul className="bf-docs__list">
          {documents.map((doc) => (
            <li key={doc.id} className="bf-docs__item">
              <button type="button" className="bf-docs__name bf-docs__link" onClick={() => void onDownload(doc)}>
                {doc.file_name}
              </button>
              <span className="bf-docs__meta muted">{formatFileSize(doc.size_bytes)}</span>
              <button type="button" className="bf-docs__remove" onClick={() => void onDelete(doc)} aria-label="Delete">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})

export default BookingDocuments
