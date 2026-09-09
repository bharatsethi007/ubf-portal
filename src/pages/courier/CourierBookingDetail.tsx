import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getCourierLabelUrl, getCourierShipment } from './courierBookingsApi'
import { courierStatusPill } from './courierBookingsColumns'
import CourierPartyBlock from './CourierPartyBlock'
import {
  fmtDate,
  fmtMoney,
  parseCommodities,
  parsePieces,
  type CourierShipment,
} from './courierShipmentTypes'
import './courierBookingDetail.css'

function GridField({ label, value }: { label: string; value: string }) {
  return (
    <div className="cbd-field">
      <span className="cbd-field__label">{label}</span>
      <span className="cbd-field__value">{value || '—'}</span>
    </div>
  )
}

function CarrierLogo({ carrier }: { carrier: string | null }) {
  const [broken, setBroken] = useState(false)
  if (!carrier) return null
  const logo = `/couriers/${carrier.toLowerCase()}.png`
  if (!broken) {
    return (
      <span className="cbd-carrier-logo">
        <img src={logo} alt={carrier} onError={() => setBroken(true)} />
      </span>
    )
  }
  return <span className="cbd-carrier-chip">{carrier}</span>
}

function shipmentTypeLabel(type: string | null): string {
  if (!type) return '—'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export default function CourierBookingDetail() {
  const { id } = useParams()
  const [row, setRow] = useState<CourierShipment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [labelBusy, setLabelBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const data = await getCourierShipment(id)
        if (cancelled) return
        setRow(data as CourierShipment)
        setError('')
      } catch (e) {
        if (cancelled) return
        setRow(null)
        setError(e instanceof Error ? e.message : 'Failed to load shipment')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  async function downloadLabel() {
    if (!row?.label_url) return
    setLabelBusy(true)
    try {
      const url = await getCourierLabelUrl(row.label_url)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not download label')
    } finally {
      setLabelBusy(false)
    }
  }

  const pieces = parsePieces(row?.pieces)
  const commodities = parseCommodities(row?.commodities)
  const isPackages = row?.shipment_type?.toLowerCase() === 'packages'

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card cbd-page">
        <header className="quotes-page__head">
          <Link
            to="/bookings/courier"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: 'var(--muted-foreground)',
              textDecoration: 'none',
              marginBottom: 8,
            }}
          >
            <ArrowLeft size={15} /> Courier bookings
          </Link>
        </header>

        {loading ? (
          <p className="muted">Loading shipment…</p>
        ) : error ? (
          <p style={{ color: '#B23B3B', fontSize: 13 }}>{error}</p>
        ) : row ? (
          <>
            <div className="cbd-header">
              <div className="cbd-header__main">
                <CarrierLogo carrier={row.carrier} />
                <div>
                  <h1 className="cbd-header__waybill">{row.waybill_no ?? 'No waybill'}</h1>
                  <div className="cbd-header__meta">
                    <span>
                      Ref <span className="cbd-header__ref">{row.booking_ref ?? '—'}</span>
                    </span>
                    {courierStatusPill(row.status)}
                    <span>Ship date {fmtDate(row.ship_date)}</span>
                  </div>
                </div>
              </div>
              {row.label_url ? (
                <Button type="button" disabled={labelBusy} onClick={() => void downloadLabel()}>
                  <Download size={16} />
                  Download label
                </Button>
              ) : null}
            </div>

            <div className="cbd-parties">
              <CourierPartyBlock
                title="Ship From"
                party={{
                  name: row.shipper_name,
                  company: row.shipper_company,
                  address1: row.shipper_address1,
                  address2: row.shipper_address2,
                  address3: row.shipper_address3,
                  city: row.shipper_city,
                  state: row.shipper_state,
                  postcode: row.shipper_postcode,
                  country: row.shipper_country,
                  phone: row.shipper_phone,
                  email: row.shipper_email,
                }}
              />
              <CourierPartyBlock
                title="Ship To"
                party={{
                  name: row.receiver_name,
                  company: row.receiver_company,
                  address1: row.receiver_address1,
                  address2: row.receiver_address2,
                  address3: row.receiver_address3,
                  city: row.receiver_city,
                  state: row.receiver_state,
                  postcode: row.receiver_postcode,
                  country: row.receiver_country,
                  phone: row.receiver_phone,
                  email: row.receiver_email,
                }}
              />
            </div>

            <section className="card booking-form-card">
              <h3 className="booking-form-card__title">Shipment details</h3>
              <div className="booking-form-card__body">
                <div className="cbd-grid">
                  <GridField label="Service" value={row.service ?? '—'} />
                  <GridField label="Shipment type" value={shipmentTypeLabel(row.shipment_type)} />
                  <GridField
                    label="Chargeable weight"
                    value={row.chargeable_weight != null ? `${row.chargeable_weight} kg` : '—'}
                  />
                </div>
                {pieces.length > 0 ? (
                  <div className="cbd-pieces">
                    {pieces.map((p, i) => (
                      <div key={i} className="cbd-piece-row">
                        Piece {i + 1}: {p.qty} × {p.weightKg} kg — {p.lengthCm} × {p.widthCm} × {p.heightCm} cm
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="card booking-form-card">
              <h3 className="booking-form-card__title">Customs information</h3>
              <div className="booking-form-card__body">
                <div className="cbd-grid">
                  <GridField label="Declared value" value={fmtMoney(row.declared_value, row.declared_currency)} />
                  <GridField label="Incoterm" value={row.incoterm ?? '—'} />
                  <GridField label="Duties paid by" value={row.duties_paid_by ?? '—'} />
                </div>
                {isPackages && commodities.length > 0 ? (
                  <div className="table-wrap" style={{ marginTop: 12 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>HS code</th>
                          <th>Qty</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commodities.map((c, i) => (
                          <tr key={i}>
                            <td>{c.description || '—'}</td>
                            <td>{c.hsCode || '—'}</td>
                            <td>{c.qty}</td>
                            <td>{fmtMoney(c.value, c.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="card booking-form-card">
              <h3 className="booking-form-card__title">Billing</h3>
              <div className="booking-form-card__body cbd-grid">
                <GridField label="Payer account" value={row.payer_account ?? '—'} />
                <GridField label="Rate" value={fmtMoney(row.rate_charge, row.rate_currency)} />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
