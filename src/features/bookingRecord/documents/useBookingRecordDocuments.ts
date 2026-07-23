import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabase'
import { toast } from 'sonner'
import {
  createDocumentTag,
  deleteBookingDocument,
  fetchBookingDocumentRows,
  fetchDocumentTags,
  signedDownloadUrl,
  updateBookingDocumentTag,
  uploadTaggedBookingFile,
} from './bookingRecordDocumentsApi'
import type { BookingDocumentRow, DocumentTag, PendingUpload, UploadProgressRow } from './documentTypes'

export function useBookingRecordDocuments(bookingId: string, accountId: string | null) {
  const [documents, setDocuments] = useState<BookingDocumentRow[]>([])
  const [tags, setTags] = useState<DocumentTag[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [progress, setProgress] = useState<UploadProgressRow[]>([])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [docs, tagRows] = await Promise.all([
        fetchBookingDocumentRows(bookingId),
        fetchDocumentTags(),
      ])
      setDocuments(docs)
      setTags(tagRows)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    void reload()
  }, [reload])

  const queueFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).map((file) => ({
      key: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      tagId: tags[0]?.id ?? null,
    }))
    setPending(list)
    setConfirmOpen(true)
  }, [tags])

  const confirmUploads = useCallback(async () => {
    setConfirmOpen(false)
    const batch = [...pending]
    setPending([])
    const folder = accountId?.trim() || 'unassigned'
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id ?? null

    for (const item of batch) {
      setProgress((p) => [...p, { key: item.key, name: item.file.name, status: 'uploading' }])
      try {
        const row = await uploadTaggedBookingFile(
          item.file,
          bookingId,
          folder,
          item.tagId,
          userId,
        )
        setDocuments((prev) => [row, ...prev])
        setProgress((p) => p.map((r) => (r.key === item.key ? { ...r, status: 'done' } : r)))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        setProgress((p) =>
          p.map((r) => (r.key === item.key ? { ...r, status: 'error', error: message } : r)),
        )
        toast.error(message)
      }
    }
    window.setTimeout(() => {
      setProgress((p) => p.filter((r) => r.status === 'uploading'))
    }, 3000)
  }, [pending, bookingId, accountId])

  const setPendingTag = useCallback((key: string, tagId: string | null) => {
    setPending((prev) => prev.map((p) => (p.key === key ? { ...p, tagId } : p)))
  }, [])

  const addTag = useCallback(async (name: string) => {
    const { data: auth } = await supabase.auth.getUser()
    const tag = await createDocumentTag(name, auth.user?.id ?? null)
    setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
    return tag
  }, [])

  const changeTag = useCallback(async (doc: BookingDocumentRow, tagId: string | null) => {
    const snapshot = doc
    const tag = tags.find((t) => t.id === tagId)
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === doc.id
          ? { ...d, tag_id: tagId, tag_name: tag?.name ?? null }
          : d,
      ),
    )
    try {
      await updateBookingDocumentTag(doc.id, tagId)
    } catch (err) {
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? snapshot : d)))
      toast.error(err instanceof Error ? err.message : 'Failed to update tag')
    }
  }, [tags])

  const remove = useCallback(async (doc: BookingDocumentRow) => {
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    try {
      await deleteBookingDocument(doc)
    } catch (err) {
      setDocuments((prev) => [doc, ...prev])
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }, [])

  const getSignedUrl = useCallback(async (doc: BookingDocumentRow) => {
    return signedDownloadUrl(doc.storage_path)
  }, [])

  const download = useCallback(async (doc: BookingDocumentRow) => {
    const url = await signedDownloadUrl(doc.storage_path)
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [])

  return {
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
    reload,
  }
}
