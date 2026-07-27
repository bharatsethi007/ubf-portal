import { toast } from 'sonner'

export function showImportSeaBookingCreatedToast(bookingRef: string): void {
  toast.success(`Booking ${bookingRef} created`, {
    description:
      'Key this ref into the ERP References tab so the sync can match the job.',
    action: {
      label: 'Copy ref',
      onClick: () => void navigator.clipboard.writeText(bookingRef),
    },
    duration: 12000,
  })
}
