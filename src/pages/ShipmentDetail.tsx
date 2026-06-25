import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bell, Link2, MoreHorizontal, Share2 } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import MapErrorBoundary from '../components/MapErrorBoundary'
import RouteMap from '../components/RouteMap'
import ShipmentDetailsCard from '../components/ShipmentDetailsCard'
import ShipmentProgressBar from '../components/ShipmentProgressBar'
import TrackingHistoryCard from '../components/TrackingHistoryCard'
import VoyageDetailsCard from '../components/VoyageDetailsCard'
import { fetchShipment } from '../hooks/useShipments'
import { useContainers } from '../hooks/useContainers'
import { useShipmentInvoices } from '../hooks/useInvoices'
import InvoicesTable from '../components/InvoicesTable'
import type { Shipment } from '../types/shipment'
import { countryLabel } from '../utils/ports'
import { fmtShort } from '../utils/format'

const LINECOLS = ['Goods Description', 'Quantity', 'Pack Type', 'Weight', 'Volume', 'Marks and Numbers', 'Final Destination']
const DOCCOLS = ['Description', 'Type', 'Size', 'Date Added', '']

const CARGO_FIELDS = [
  'goods_desc',
  'pack_qty',
  'pack_type',
  'weight_kg',
  'volume_m3',
  'marks',
  'final_dest',
] as const

function hasHousebillLines(shipment: Shipment): boolean {
  return CARGO_FIELDS.some((key) => shipment[key] != null && shipment[key] !== '')
}

function cargoCell(value: string | number | null, suffix = ''): string {
  if (value == null || value === '') return '—'
  return `${value}${suffix}`
}

export default function ShipmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [loading, setLoading] = useState(true)
  const consolKey = shipment?.mode === 'sea' ? shipment.consol_key : null
  const { containers, loading: containersLoading } = useContainers(consolKey)
  const { invoices, loading: invoicesLoading } = useShipmentInvoices(shipment?.job_unique ?? null)

  useEffect(() => {
    const jobUnique = Number(id)
    if (!jobUnique) {
      setLoading(false)
      return
    }
    fetchShipment(jobUnique).then((data) => {
      setShipment(data)
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="muted pad">Loading shipment…</div>
  if (!shipment) {
    return (
      <div className="empty card">
        Shipment not found. <Link to="/shipments">Back to shipments</Link>
      </div>
    )
  }

  const routeTitle = `${shipment.origin ?? '—'} (${countryLabel(shipment.origin)}) → ${shipment.destination ?? '—'} (${countryLabel(shipment.destination)})`

  return (
    <div className="detail-page">
      <header className="detail-header">
        <div>
          <button type="button" className="detail-back" onClick={() => navigate(-1)}>← Back</button>
          <h1>Shipment {shipment.job_unique}</h1>
          <p className="detail-route">{routeTitle}</p>
        </div>
        <div className="detail-actions">
          <button type="button" className="icon-btn" aria-label="Notifications"><Bell size={18} /></button>
          <button type="button" className="icon-btn" aria-label="Copy link"><Link2 size={18} /></button>
          <button type="button" className="icon-btn" aria-label="Share"><Share2 size={18} /></button>
          <button type="button" className="icon-btn" aria-label="More options"><MoreHorizontal size={18} /></button>
        </div>
      </header>

      <ShipmentProgressBar shipment={shipment} />

      <div className="detail-grid">
        <ShipmentDetailsCard shipment={shipment} />

        <section className="card detail-card detail-map">
          <h2>Route Map</h2>
          <MapErrorBoundary>
            <RouteMap
              originCode={shipment.origin}
              destCode={shipment.destination}
              mode={shipment.mode}
              etd={shipment.etd}
              eta={shipment.eta}
              departed={shipment.departed}
              arrived={shipment.arrived}
              status={shipment.status}
            />
          </MapErrorBoundary>
        </section>

        <TrackingHistoryCard shipment={shipment} />
        <VoyageDetailsCard shipment={shipment} />
      </div>

      <section className="card detail-card detail-section">
        <h2>Housebill Lines</h2>
        <div className="detail-table-shell">
          <table className="data-table data-table--compact">
            <thead>
              <tr>{LINECOLS.map((col) => <th key={col}>{col}</th>)}</tr>
            </thead>
            {hasHousebillLines(shipment) && (
              <tbody>
                <tr>
                  <td>{cargoCell(shipment.goods_desc)}</td>
                  <td>{cargoCell(shipment.pack_qty)}</td>
                  <td>{cargoCell(shipment.pack_type)}</td>
                  <td>{cargoCell(shipment.weight_kg, ' kg')}</td>
                  <td>{cargoCell(shipment.volume_m3, ' m³')}</td>
                  <td>{cargoCell(shipment.marks)}</td>
                  <td>{cargoCell(shipment.final_dest)}</td>
                </tr>
              </tbody>
            )}
          </table>
          {!hasHousebillLines(shipment) && <EmptyState />}
        </div>
      </section>

      {shipment.mode === 'sea' && (
        <section className="card detail-card detail-section">
          <h2>Containers</h2>
          <div className="detail-table-shell">
            {containersLoading ? (
              <p className="muted pad-inline">Loading containers…</p>
            ) : containers.length === 0 ? (
              <p className="muted pad-inline">No containers recorded.</p>
            ) : (
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Container No</th>
                    <th>Seal</th>
                    <th>Available From</th>
                    <th>Available To</th>
                  </tr>
                </thead>
                <tbody>
                  {containers.map((c) => (
                    <tr key={c.c_number}>
                      <td className="mono">{c.c_number}</td>
                      <td>{c.seal ?? '—'}</td>
                      <td className="mono">{fmtShort(c.avail_from)}</td>
                      <td className="mono">{fmtShort(c.avail_to)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      <section className="card detail-card detail-section">
        <h2>Invoices</h2>
        <div className="detail-table-shell">
          <InvoicesTable
            invoices={invoices}
            loading={invoicesLoading}
            defaultShowPaid
            emptyMessage="No invoices for this shipment."
          />
        </div>
      </section>

      <div className="detail-grid detail-grid--2">
        <section className="card detail-card detail-section">
          <h2>Summary</h2>
          <EmptyState />
        </section>

        <section className="card detail-card detail-section">
          <h2>Documents</h2>
          <div className="detail-table-shell">
            <table className="data-table data-table--compact">
              <thead>
                <tr>{DOCCOLS.map((col, i) => <th key={col || i}>{col}</th>)}</tr>
              </thead>
            </table>
            <EmptyState />
          </div>
        </section>
      </div>
    </div>
  )
}
