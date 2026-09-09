import { newCourierPiece } from './CourierCargoPanel'
import CourierPieceRows from './CourierPieceRows'
import CourierBookingCommodityTable from './CourierBookingCommodityTable'
import {
  COURIER_INCOTERMS, COURIER_PURPOSES, type CourierBookingFormState,
} from './courierBookingTypes'
import './quoteCargoEntry.css'

type Props = {
  form: CourierBookingFormState
  onChange: (form: CourierBookingFormState) => void
}

export default function CourierBookingFormSections({ form, onChange }: Props) {
  function patch(p: Partial<CourierBookingFormState>) {
    onChange({ ...form, ...p })
  }

  return (
    <>
      <section className="cbf-section">
        <h3 className="cbf-section-title">Shipment</h3>
        <div className="qce__toggle" role="tablist" aria-label="Shipment type">
          <button type="button" role="tab" aria-selected={form.isDocuments}
            className={`qce__toggle-btn${form.isDocuments ? ' qce__toggle-btn--on' : ''}`}
            onClick={() => patch({ isDocuments: true })}>Documents</button>
          <button type="button" role="tab" aria-selected={!form.isDocuments}
            className={`qce__toggle-btn${!form.isDocuments ? ' qce__toggle-btn--on' : ''}`}
            onClick={() => patch({ isDocuments: false })}>Packages</button>
        </div>
        <label className="cbf-field" style={{ maxWidth: 280 }}>
          <span className="cbf-label">Purpose</span>
          <select className="cbf-input" value={form.purpose} onChange={(e) => patch({ purpose: e.target.value })}>
            {COURIER_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        {!form.isDocuments && (
          <CourierBookingCommodityTable lines={form.commodities} onChange={(commodities) => patch({ commodities })} />
        )}
      </section>

      {!form.isDocuments && (
        <section className="cbf-section">
          <h3 className="cbf-section-title">Customs invoice</h3>
          <div className="cbf-fields cbf-fields--wide">
            <label className="cbf-field">
              <span className="cbf-label">Invoice number (optional)</span>
              <input className="cbf-input" value={form.invoiceNumber} onChange={(e) => patch({ invoiceNumber: e.target.value })} />
            </label>
            <label className="cbf-field">
              <span className="cbf-label">Remarks</span>
              <textarea className="cbf-input" rows={2} value={form.remarks} onChange={(e) => patch({ remarks: e.target.value })} />
            </label>
          </div>
        </section>
      )}

      <section className="cbf-section">
        <h3 className="cbf-section-title">Packaging</h3>
        <CourierPieceRows
          pieces={form.pieces}
          onChange={(pieces) => patch({ pieces })}
          onAddPiece={() => patch({ pieces: [...form.pieces, newCourierPiece()] })}
        />
      </section>

      <section className="cbf-section">
        <h3 className="cbf-section-title">Pay</h3>
        <div className="cbf-fields">
          <label className="cbf-field">
            <span className="cbf-label">Payer account</span>
            <input className="cbf-input" value={form.payerAccount} onChange={(e) => patch({ payerAccount: e.target.value })} />
          </label>
          <label className="cbf-field">
            <span className="cbf-label">Duties paid by</span>
            <select className="cbf-input" value={form.dutiesPaidBy} onChange={(e) => patch({ dutiesPaidBy: e.target.value as 'Sender' | 'Receiver' })}>
              <option value="Sender">Sender</option>
              <option value="Receiver">Receiver</option>
            </select>
          </label>
          <label className="cbf-field cbf-field--span2">
            <span className="cbf-label">Incoterm</span>
            <select className="cbf-input" value={form.incoterm} onChange={(e) => patch({ incoterm: e.target.value })}>
              {COURIER_INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
        </div>
      </section>
    </>
  )
}
