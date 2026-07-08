import { useEffect, useState } from 'react'
import {
  loadBookingSourceEmail,
  signedEmailAttachmentUrl,
  type BookingSourceEmail,
} from '../../components/bookings/bookingSourceEmailApi'

export function useBookingSourceEmail(bookingId: string | undefined, isEmailImport: boolean) {
  const [source, setSource] = useState<BookingSourceEmail | null>(null)
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [attachmentErrors, setAttachmentErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!bookingId || !isEmailImport) {
      setSource(null)
      setAttachmentUrls({})
      setAttachmentErrors({})
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const row = await loadBookingSourceEmail(bookingId)
        if (cancelled) return
        setSource(row)

        const paths = row?.attachment_paths ?? []
        const urls: Record<string, string> = {}
        const errs: Record<string, string> = {}
        await Promise.all(paths.map(async (path) => {
          try {
            urls[path] = await signedEmailAttachmentUrl(path)
          } catch (e) {
            errs[path] = e instanceof Error ? e.message : 'Link failed'
          }
        }))
        if (!cancelled) {
          setAttachmentUrls(urls)
          setAttachmentErrors(errs)
        }
      } catch {
        if (!cancelled) setSource(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [bookingId, isEmailImport])

  return { source, attachmentUrls, attachmentErrors, loading }
}
