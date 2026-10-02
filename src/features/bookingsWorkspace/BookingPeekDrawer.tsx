import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, FileText, Truck, X } from 'lucide-react'
import type { ImportSeaRow } from '@/features/importSea/types'
import { containerSizeSummary } from '@/features/importSea/containerSize'
import { STAGES, ddmm, dueLabel, stageIndex, urgencyTone, whyText } from './flowText'
import type { BookingFlow } from './useBookingFlow'
import BookingProgressPanel from '@/features/bookingRecord/progress/BookingProgressPanel'
import { useBookingProgress } from '@/features/bookingRecord/progress/useBookingProgress'

type Props = {
  row: ImportSeaRow | undefined
  flow: BookingFlow | undefined
  recordHref: string
  onClose: () => void
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bk-peek__fact">
      <span className="bk-peek__k">{label}</span>
      <span className={`bk-peek__v${tone ? ` bk-peek__v--${tone}` : ''}`}>{value || '—'}</span>
    </div>
  )
}

function Chip({ on, label, warn }: { on: boolean; label: string; warn?: boolean }) {
  return <span className={`bk-chip ${warn ? 'bk-chip--warn' : on ? 'bk-chip--on' : ''}`}>{label}</span>
}

export default function BookingPeekDrawer({ row, flow, recordHref, onClose }: Props) {
  const navigate = useNavigate()
  const { progress, reload } = useBookingProgress(row?.id, `${flow?.next_action}|${flow?.priority}`)
  useEffect(() => {
    if (!row) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [row, onClose])

  if (!row) return null

  const tone = flow?.next_action ? urgencyTone(flow.urgency) : 'green'
  const current = stageIndex(flow?.stage)
  const atf = row.m_atf?.trim()
  const ubfYard = atf === '31853'
  const containers = (row.containers ?? []).filter((c) => c.container_no?.trim())

  return (
    <>
      <button type="button" className="bk-peek-scrim" aria-label="Close panel" onClick={onClose} />
      <aside className="bk-peek" aria-label={`Booking ${row.booking_ref ?? ''}`}>
        <header className="bk-peek__head">
          <div className="bk-peek__row">
            <Link to={recordHref} className="bk-peek__ref">{row.booking_ref}</Link>
            {row.matched
              ? <span className="bk-pill bk-pill--green">ERP {row.job_no ?? 'linked'}</span>
              : <span className="bk-pill bk-pill--amber">Not in ERP</span>}
            {row.load_type ? <span className="bk-pill">{row.load_type}</span> : null}
            <span className="bk-gap" />
            <Link to={recordHref} className="bk-ib" title="Open booking" aria-label="Open booking">
              <ArrowUpRight size={15} />
            </Link>
            <button type="button" className="bk-ib bk-ib--ghost" onClick={onClose} title="Close" aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div className="bk-peek__client" title={row.customer_name ?? ''}>
            {row.customer_id
              ? <Link to={`/customers/${row.customer_id}`}>{row.customer_name ?? 'Client not set'}</Link>
              : (row.customer_name ?? 'Client not set')}
          </div>
          <div className="bk-peek__sub">
            <span>{row.shipping_line || 'Line not set'}</span>
            <span className="bk-dotsep" />
            <span>{row.discharge_port || 'Port not set'}</span>
            <span className="bk-dotsep" />
            <span>{containerSizeSummary(containers) || 'No containers'}</span>
          </div>
        </header>

        {progress ? (
          <BookingProgressPanel
            progress={progress}
            variant="compact"
            containers={containers.map((c) => c.container_no!.trim())}
            onGoto={(t) => navigate(`${recordHref}${recordHref.includes('?') ? '&' : '?'}tab=${t === 'portal_request' ? 'details' : t}`)}
            onChanged={() => { void reload() }}
          />
        ) : (
          <>
          <section className="bk-peek__sec">
            <div className="bk-steps">
              {STAGES.map((s, i) => {
                const state = i < current ? 'done' : i === current ? 'now' : 'todo'
                return (
                  <div key={s.key} className={`bk-step bk-step--${state}`}>
                    <span className="bk-step__bar" />
                    <span className="bk-step__label">{s.label}</span>
                  </div>
                )
              })}
            </div>
          </section>

          <section className={`bk-next bk-next--${tone}`}>
            <div className="bk-next__body">
              <div className="bk-next__title">
                <span>{flow?.next_action ?? 'On track'}</span>
                {flow?.next_action ? <span className={`bk-due bk-due--${tone}`}>{dueLabel(flow)}</span> : null}
              </div>
              <div className="bk-next__why">{whyText(flow, row)}</div>
            </div>
            <Link to={recordHref} className="bk-btn bk-btn--p">Open booking</Link>
          </section>
          </>
        )}

        <section className="bk-peek__sec bk-peek__facts">
          <Fact label="ETA" value={ddmm(row.eta)} tone={row.eta_source === 'portconnect' ? 'pc' : undefined} />
          <Fact label="LFD" value={ddmm(row.last_free_day)} />
          <Fact label="Delivery" value={ddmm(row.delivery_date)} />
          <Fact label="Return" value={ddmm(row.container_return_date)} />
          <Fact label="ATF" value={atf ? (ubfYard ? 'UBF yard' : `Client ${atf}`) : ''} />
          <Fact label="Devanner" value={ubfYard ? (row.ubf_devanner ?? '') : ''} />
          <Fact label="Owner" value={row.handler_name ?? 'Unassigned'} />
          <Fact label="Hold" value={row.hold_label ?? 'None'} tone={row.hold_label ? 'red' : undefined} />
        </section>

        <section className="bk-peek__sec">
          <div className="bk-peek__label">Clearance and ops</div>
          <div className="bk-chips">
            <Chip on={Boolean(row.swb_released)} label="SWB" />
            <Chip on={Boolean(row.tlx_release_on_hand)} label="TLX" />
            <Chip on={Boolean(row.bacc_sent)} label="BACC" />
            <Chip on={Boolean(row.port_cleared)} warn={Boolean(row.port_clearance_cancelled)} label="PORT" />
            <Chip on={Boolean(row.line_released)} warn={Boolean(row.line_release_cancelled)} label="LINE" />
            <Chip on={Boolean(row.cleared)} label="UBF" />
            <Chip on={Boolean(row.truck_booked)} label="TRK" />
            <Chip on={Boolean(row.inv_approved)} label="INV APPR" />
            <Chip on={Boolean(row.inv_sent)} label="INV SENT" />
          </div>
        </section>

        {containers.length ? (
          <section className="bk-peek__sec">
            <div className="bk-peek__label">Containers</div>
            <ul className="bk-peek__list">
              {containers.map((c, i) => (
                <li key={`${c.container_no}-${i}`}>
                  <span className="bk-mono">{c.container_no}</span>
                  <span className="bk-muted">{c.iso_desc ?? c.container_type ?? 'type not set'}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="bk-peek__sec bk-peek__links">
          {flow?.quote_id ? (
            <Link to={`/quotes/${flow.quote_id}`} className="bk-link"><FileText size={14} />Quote {flow.quote_no}</Link>
          ) : null}
          {flow?.tms_id ? (
            <Link to="/tms" className="bk-link"><Truck size={14} />TMS {flow.tms_no ?? ''} · {flow.tms_status}</Link>
          ) : null}
          {flow && flow.open_tasks > 0 ? <span className="bk-muted">{flow.open_tasks} open task{flow.open_tasks === 1 ? '' : 's'}</span> : null}
        </section>
      </aside>
    </>
  )
}
