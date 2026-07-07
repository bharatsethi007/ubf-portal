import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { usePorts } from '../../../hooks/usePorts'
import ShipmentDetailHeader from './ShipmentDetailHeader'
import { DETAIL_TABS, type DetailTab } from './portalShipmentDetailTypes'
import { usePortalShipment } from './usePortalShipment'
import AdditionalServicesTab from './tabs/AdditionalServicesTab'
import CargoContainersTab from './tabs/CargoContainersTab'
import DocumentsTab from './tabs/DocumentsTab'
import InvoicesTab from './tabs/InvoicesTab'
import SummaryTab from './tabs/SummaryTab'
import TaskTab from './tabs/TaskTab'
import TrackTraceTab from './tabs/TrackTraceTab'

export default function PortalShipmentDetailPage() {
  const { jobNo } = useParams()
  const { ports } = usePorts()
  const { data, loading, error } = usePortalShipment(jobNo)
  const [tab, setTab] = useState<DetailTab>('Summary')

  if (loading) {
    return <p className="portal-empty">Loading shipment…</p>
  }

  if (error) {
    return <p className="portal-empty" style={{ color: 'var(--portal-orange)' }}>{error}</p>
  }

  if (!data) {
    return (
      <div className="portal-detail-notfound">
        <p className="portal-empty">Shipment not found.</p>
      </div>
    )
  }

  return (
    <div className="portal-detail-page">
      <ShipmentDetailHeader shipment={data.shipment} />

      <div className="portal-detail-tabs" role="tablist" aria-label="Shipment sections">
        {DETAIL_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`portal-detail-tab${tab === t ? ' portal-detail-tab--on' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="portal-card portal-card--pad portal-detail-panel">
        {tab === 'Summary' && <SummaryTab data={data} ports={ports} />}
        {tab === 'Task' && <TaskTab tasks={data.tasks} />}
        {tab === 'Track & trace' && <TrackTraceTab timeline={data.timeline} />}
        {tab === 'Invoices' && <InvoicesTab invoices={data.invoices} />}
        {tab === 'Cargo & containers' && (
          <CargoContainersTab shipment={data.shipment} containers={data.containers} />
        )}
        {tab === 'Documents' && <DocumentsTab />}
        {tab === 'Additional services' && <AdditionalServicesTab />}
      </div>
    </div>
  )
}
