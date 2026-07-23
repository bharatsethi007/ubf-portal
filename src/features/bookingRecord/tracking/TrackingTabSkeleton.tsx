import { Skeleton, SkeletonBusy } from '@/components/ui/skeleton'

type Props = { busy?: boolean }

export default function TrackingTabSkeleton({ busy = true }: Props) {
  return (
    <SkeletonBusy busy={busy} className="booking-tracking-tab">
      <section className="card booking-tracking-enable" aria-hidden>
        <Skeleton className="booking-sk-enable-title" />
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="booking-tracking-enable__row booking-sk-enable-row">
            <div className="booking-tracking-enable__head">
              <Skeleton className="booking-sk-enable-switch-row" />
              <Skeleton className="booking-sk-enable-sync" />
            </div>
            <Skeleton className="booking-sk-enable-field" />
            {i === 0 ? <Skeleton className="booking-sk-track-grid" /> : null}
          </div>
        ))}
      </section>
    </SkeletonBusy>
  )
}
