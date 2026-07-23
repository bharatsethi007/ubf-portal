import { Link, type URLSearchParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton, SkeletonBusy } from '@/components/ui/skeleton'
import { importSeaBackHref } from '@/features/importSea/importSeaFilterUrl'

type Props = {
  searchParams: URLSearchParams
  busy?: boolean
}

function FormCardSkeleton({
  fields,
  titleWidth,
  tallLastField,
}: {
  fields: number
  titleWidth: number
  tallLastField?: boolean
}) {
  return (
    <section className="card booking-form-card" aria-hidden>
      <Skeleton className="booking-sk-card-title" style={{ width: titleWidth }} />
      <div className="booking-form-card__body">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="booking-sk-field">
            <Skeleton className="booking-sk-label" style={{ width: 44 + (i % 3) * 12 }} />
            <Skeleton
              className={i === fields - 1 && tallLastField ? 'booking-sk-textarea' : 'booking-sk-input'}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

function ShipmentCardSkeleton() {
  return (
    <section className="card booking-form-card" aria-hidden>
      <Skeleton className="booking-sk-card-title" style={{ width: 56 }} />
      <div className="booking-form-card__body">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="booking-sk-field">
            <Skeleton className="booking-sk-label" style={{ width: 52 + i * 8 }} />
            <Skeleton className="booking-sk-input" />
          </div>
        ))}
        <div className="booking-containers-field">
          <Skeleton className="booking-sk-label" style={{ width: 64 }} />
          <div className="booking-containers-field__list">
            <Skeleton className="booking-sk-container-row" />
            <Skeleton className="booking-sk-container-row" />
          </div>
          <Skeleton className="booking-sk-container-add" />
        </div>
      </div>
    </section>
  )
}

function TaskPanelSkeleton() {
  return (
    <aside className="card booking-task-panel" aria-hidden>
      <section className="booking-milestones">
        <Skeleton className="booking-sk-card-title" style={{ width: 64 }} />
        <Skeleton className="booking-sk-milestone-caption" />
        <ul className="booking-milestones__list">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="booking-milestones__row">
              <Skeleton className="booking-sk-milestone-label" style={{ width: 88 + i * 6 }} />
              <Skeleton className="booking-sk-switch" />
            </li>
          ))}
        </ul>
      </section>
      <hr className="booking-panel-divider" />
      <section className="booking-tasks-section">
        <Skeleton className="booking-sk-card-title" style={{ width: 36 }} />
        <Skeleton className="booking-sk-progress-bar" />
        <Skeleton className="booking-sk-progress-label" />
        <div className="booking-task-panel__list">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="booking-task-row booking-sk-task-row">
              <Skeleton className="booking-sk-task-check rounded-sm" />
              <Skeleton className="booking-sk-task-title" style={{ width: `${52 + (i % 4) * 8}%` }} />
              <Skeleton className="booking-sk-task-avatar rounded-full" />
              <Skeleton className="booking-sk-task-due" />
            </div>
          ))}
        </div>
        <Skeleton className="booking-sk-task-add" />
      </section>
    </aside>
  )
}

function HeaderSkeleton() {
  return (
    <header className="card booking-record-header booking-record-header--compact" aria-hidden>
      <div className="booking-record-header__row">
        <Skeleton className="booking-sk-header-ref" />
        <Skeleton className="booking-sk-header-badge" />
        <span className="booking-record-header__sep" aria-hidden>·</span>
        <Skeleton className="booking-sk-header-client" />
        <span className="booking-record-header__sep" aria-hidden>·</span>
        <Skeleton className="booking-sk-header-meta" />
        <span className="booking-record-header__sep" aria-hidden>·</span>
        <Skeleton className="booking-sk-header-eta" />
      </div>
    </header>
  )
}

export default function BookingRecordSkeleton({ searchParams, busy = true }: Props) {
  const backHref = importSeaBackHref(searchParams)

  return (
    <div className="detail-page booking-record-page">
      <Link to={backHref} className="detail-back booking-record-back">
        ← Back to Import Sea board
      </Link>

      <SkeletonBusy busy={busy}>
        <HeaderSkeleton />

        <Tabs defaultValue="details" className="booking-record-tabs">
          <TabsList variant="line" className="booking-record-tabs__list">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="tracking">Tracking</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="booking-details-grid">
              <div className="booking-details-col">
                <FormCardSkeleton fields={7} titleWidth={52} />
              </div>
              <div className="booking-details-col">
                <ShipmentCardSkeleton />
                <FormCardSkeleton fields={2} titleWidth={32} tallLastField />
              </div>
              <div className="booking-details-col">
                <FormCardSkeleton fields={5} titleWidth={40} />
              </div>
              <TaskPanelSkeleton />
            </div>
          </TabsContent>
        </Tabs>
      </SkeletonBusy>
    </div>
  )
}
