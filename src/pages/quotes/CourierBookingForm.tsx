import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { bookDhlCourier } from './courierSearchApi'
import type { DhlCourierBookBody } from './courierBookingTypes'
import { buildCourierBookingFormState, type CourierBookingPrefill } from './courierBookingPrefill'
import { commoditiesToPayload, piecesToSearch, type CourierBookingFormState } from './courierBookingTypes'
import CourierBookingAddressBlock from './CourierBookingAddressBlock'
import CourierBookingFormSections from './CourierBookingFormSections'
import { downloadLabelBase64 } from './courierBookingLabel'
import type { CourierCourierOption } from './CourierCourierSelector'
import './courierBooking.css'

export type CourierBookingFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefill: CourierBookingPrefill
  selectedRate: CourierCourierOption
  quoteId?: string | null
}

type Success = { bookingRef: string; bookingId?: string; labelBase64?: string }

export default function CourierBookingForm({ open, onOpenChange, prefill, selectedRate, quoteId }: CourierBookingFormProps) {
  const [form, setForm] = useState<CourierBookingFormState>(() => buildCourierBookingFormState(prefill))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<Success | null>(null)

  useEffect(() => {
    if (open) {
      setForm(buildCourierBookingFormState(prefill))
      setError(null)
      setSuccess(null)
      setSubmitting(false)
    }
  }, [open, prefill])

  function buildBody(): DhlCourierBookBody {
    return {
      quoteId: quoteId ?? undefined,
      service: selectedRate.service,
      serviceCode: selectedRate.serviceCode,
      rateCharge: selectedRate.charge,
      rateCurrency: selectedRate.currency ?? 'NZD',
      isDocuments: form.isDocuments,
      purpose: form.purpose,
      shipper: form.shipper,
      receiver: form.receiver,
      commodities: commoditiesToPayload(form.commodities),
      invoiceNumber: form.invoiceNumber || undefined,
      remarks: form.remarks || undefined,
      pieces: piecesToSearch(form.pieces),
      payerAccount: form.payerAccount,
      dutiesPaidBy: form.dutiesPaidBy,
      incoterm: form.incoterm,
    }
  }

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await bookDhlCourier(buildBody())
      if (!res.ok) {
        setError([res.reason, res.detail].filter(Boolean).join(' — '))
        return
      }
      setSuccess({ bookingRef: res.bookingRef, bookingId: res.bookingId, labelBase64: res.labelBase64 })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Book DHL shipment · {selectedRate.service}</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="cbf-success">
            <p style={{ margin: 0, fontSize: 14 }}>Booking created: <strong>{success.bookingRef}</strong></p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {success.labelBase64 && (
                <Button type="button" variant="outline" size="sm" onClick={() => downloadLabelBase64(success.labelBase64!)}>
                  Download label
                </Button>
              )}
              {success.bookingId && (
                <Link to={`/bookings/${success.bookingId}`} className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                  View booking
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="cbf-scroll">
            <div className="cbf-grid-2">
              <CourierBookingAddressBlock title="From (shipper)" value={form.shipper} onChange={(shipper) => setForm({ ...form, shipper })} />
              <CourierBookingAddressBlock title="To (receiver)" value={form.receiver} onChange={(receiver) => setForm({ ...form, receiver })} defaultResidential={prefill.to.residential} />
            </div>
            <CourierBookingFormSections form={form} onChange={setForm} />
            {error && <p className="cbf-error">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {!success && (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="button" onClick={() => void submit()} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit booking'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
