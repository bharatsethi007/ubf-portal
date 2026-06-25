import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Shipment } from '../types/shipment'
import { fmtShort } from '../utils/format'
import JobStatusRail from './JobStatusRail'
import MapErrorBoundary from './MapErrorBoundary'
import RouteMap from './RouteMap'
import MasterBillField from './shipments/MasterBillField'
import TrackingToggle from './shipments/TrackingToggle'
import SlideDrawer from './SlideDrawer'
import StatusPill from './StatusPill'

type Props = {
  jobUnique: number | null
  consolKey: string | null
  onClose: () => void
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="job-drawer__fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export default function JobDetailDrawer({ jobUnique, consolKey, onClose }: Props) {
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!jobUnique) {
      setShipment(null)
      setError('')
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    supabase
      .from('shipments')
      .select('*, customers ( name )')
      .eq('job_unique', jobUnique)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
          setShipment(null)
        } else {
          setShipment((data as Shipment) ?? null)
          if (!data) setError('Job not found.')
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [jobUnique])

  const open = jobUnique != null
  const jobNo = shipment?.job_no ?? (jobUnique ? String(jobUnique) : '—')
  const houseBill = shipment?.house_bill ?? '—'

  const footer = (
    <>
      {consolKey && (
        <button type="button" className="job-drawer__consol-link" onClick={onClose}>
          Consol {consolKey}
        </button>
      )}
      <button type="button" className="btn job-drawer__close-btn" onClick={onClose}>
        Close
      </button>
    </>
  )

  return (
    <SlideDrawer open={open} onClose={onClose} ariaLabel="Job details" footer={footer}>
      {loading && <p className="muted job-drawer__loading">Loading job…</p>}
      {error && !loading && <p className="error job-drawer__loading">{error}</p>}
      {shipment && !loading && (
        <div className="job-drawer">
          <header className="job-drawer__header">
            <div>
              <h2 className="job-drawer__title">
                <span className="mono">{jobNo}</span>
                {houseBill !== '—' && (
                  <span className="job-drawer__house-bill mono">{houseBill}</span>
                )}
              </h2>
              {consolKey && (
                <p className="job-drawer__consol muted">
                  Consol <span className="mono">{consolKey}</span>
                </p>
              )}
            </div>
            <StatusPill status={shipment.status} />
          </header>

          <dl className="job-drawer__facts job-drawer__summary">
            <MasterBillField mode={shipment.mode} value={shipment.master_bill} />
          </dl>

          {consolKey && (
            <TrackingToggle consolKey={consolKey} module={shipment.module} layout="detail" />
          )}

          <JobStatusRail shipment={shipment} />

          <section className="job-drawer__section">
            <h3>Route</h3>
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
            <p className="job-drawer__route mono">
              {shipment.origin ?? '—'} → {shipment.destination ?? '—'}
            </p>
            <dl className="job-drawer__facts">
              <Fact label="Mode" value={shipment.mode === 'air' ? 'Air' : 'Sea'} />
              <Fact label="Direction" value={shipment.direction ?? '—'} />
              <Fact label="Vessel/Flight" value={shipment.vessel_flight ?? '—'} />
            </dl>
          </section>

          <section className="job-drawer__section">
            <h3>Dates</h3>
            <dl className="job-drawer__facts">
              <Fact label="ETD" value={fmtShort(shipment.etd)} />
              <Fact label="ETA" value={fmtShort(shipment.eta)} />
              <Fact label="Departed" value={fmtShort(shipment.departed)} />
              <Fact label="Arrived" value={fmtShort(shipment.arrived)} />
              <Fact label="Doc date" value={fmtShort(shipment.doc_date)} />
            </dl>
          </section>

          <section className="job-drawer__section">
            <h3>Parties</h3>
            <dl className="job-drawer__facts">
              <Fact
                label="Customer"
                value={shipment.customers?.name ?? (shipment.customer_account_id ? String(shipment.customer_account_id) : '—')}
              />
            </dl>
          </section>
        </div>
      )}
    </SlideDrawer>
  )
}
