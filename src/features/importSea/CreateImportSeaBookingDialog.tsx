import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import CustomerField from '@/features/bookingRecord/form/CustomerField'
import StaffField from '@/features/bookingRecord/form/StaffField'
import { fetchStaffUsers } from '@/features/bookingRecord/bookingRecordApi'
import type { StaffUser } from '@/features/bookingRecord/bookingRecordTypes'
import type { CustomerPickerValue } from '@/hooks/useBookings'
import { supabase } from '@/supabase'
import { bookingRecordHref } from './importSeaFilterUrl'
import { createImportSeaBooking } from './createImportSeaBookingApi'
import { showImportSeaBookingCreatedToast } from './importSeaBookingCreatedToast'
import CreateImportSeaContainerList, {
  draftContainersForSave,
  emptyDraftContainerRow,
  firstContainerValidationError,
  type DraftContainerRow,
} from './CreateImportSeaContainerList'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

function sameCustomer(
  a: CustomerPickerValue | null,
  b: CustomerPickerValue | null,
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.account_id === b.account_id
}

export default function CreateImportSeaBookingDialog({ open, onOpenChange, onCreated }: Props) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [client, setClient] = useState<CustomerPickerValue | null>(null)
  const [consignee, setConsignee] = useState<CustomerPickerValue | null>(null)
  const [consigneeTouched, setConsigneeTouched] = useState(false)
  const [jobNo, setJobNo] = useState('')
  const [mbl, setMbl] = useState('')
  const [eta, setEta] = useState('')
  const [handledBy, setHandledBy] = useState<string | null>(null)
  const [containers, setContainers] = useState<DraftContainerRow[]>([])
  const [saving, setSaving] = useState(false)
  const [clientError, setClientError] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false

    void (async () => {
      const [{ data: auth }, staffUsers] = await Promise.all([
        supabase.auth.getUser(),
        fetchStaffUsers(),
      ])
      if (cancelled) return
      setStaff(staffUsers)
      setHandledBy(auth.user?.id ?? null)
    })()

    return () => {
      cancelled = true
    }
  }, [open])

  function resetForm() {
    setClient(null)
    setConsignee(null)
    setConsigneeTouched(false)
    setJobNo('')
    setMbl('')
    setEta('')
    setContainers([])
    setClientError('')
  }

  function handleClientChange(next: CustomerPickerValue | null) {
    setClient(next)
    setClientError('')
    if (!consigneeTouched || sameCustomer(consignee, client)) {
      setConsignee(next)
    }
  }

  function closeDialog() {
    resetForm()
    onOpenChange(false)
  }

  async function handleSave() {
    if (!client?.account_id) {
      setClientError('Client is required.')
      return
    }

    const containerError = firstContainerValidationError(containers)
    if (containerError) {
      toast.error(containerError)
      return
    }

    setSaving(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const created = await createImportSeaBooking({
        account_id: client.account_id,
        consignee_account_id: consignee?.account_id ?? client.account_id,
        importer_account_id: client.account_id,
        job_no: jobNo.trim() || null,
        mbl_no: mbl.trim() || null,
        m_eta: eta.trim() || null,
        handled_by: handledBy,
        created_by: auth.user?.id ?? null,
        containers: draftContainersForSave(containers),
      })

      closeDialog()
      onCreated?.()
      showImportSeaBookingCreatedToast(created.booking_ref)
      navigate(bookingRecordHref(created.id, searchParams))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create booking')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm()
        onOpenChange(next)
      }}
    >
      <DialogContent className="create-import-sea-dialog sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New import sea booking</DialogTitle>
          <DialogDescription>
            Capture the basics from an email or enquiry — you can fill in the rest on the record.
          </DialogDescription>
        </DialogHeader>

        <div className="create-import-sea-dialog__form">
          <CustomerField label="Client *" value={client} onChange={handleClientChange} />
          {clientError ? <p className="create-import-sea-dialog__error">{clientError}</p> : null}

          <CustomerField
            label="Consignee"
            value={consignee}
            onChange={(next) => {
              setConsigneeTouched(true)
              setConsignee(next)
            }}
          />

          <label className="filter-field booking-form-field">
            <span className="filter-field__label">Job #</span>
            <input
              type="text"
              className="input input--sm mono"
              value={jobNo}
              placeholder="Optional"
              onChange={(e) => setJobNo(e.target.value)}
            />
          </label>

          <label className="filter-field booking-form-field">
            <span className="filter-field__label">Master B/L (tracking)</span>
            <input
              type="text"
              className="input input--sm mono"
              value={mbl}
              placeholder="Optional"
              onChange={(e) => setMbl(e.target.value)}
            />
          </label>

          <CreateImportSeaContainerList rows={containers} onChange={setContainers} />

          <label className="filter-field booking-form-field">
            <span className="filter-field__label">ETA</span>
            <input
              type="date"
              className="input input--sm"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
            />
          </label>

          <StaffField value={handledBy} staff={staff} onChange={setHandledBy} />

          <label className="filter-field booking-form-field">
            <span className="filter-field__label">Booking ref</span>
            <input
              type="text"
              className="input input--sm muted"
              value="Will be assigned on save"
              readOnly
            />
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving}
            className="!bg-ub-navy !text-white hover:!bg-ub-navy/90 !border-ub-navy"
            onClick={() => void handleSave()}
          >
            {saving ? 'Creating…' : 'Create booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
