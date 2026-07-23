import { Skeleton } from '@/components/ui/skeleton'

const ROW_COUNT = 12

function SkeletonRow({ index }: { index: number }) {
  return (
    <tr className="import-sea-sk-row" aria-hidden>
      <td>
        <Skeleton className="import-sea-sk-ref" />
      </td>
      <td className="import-sea-col-client">
        <Skeleton className="import-sea-sk-client" />
      </td>
      <td><Skeleton className="import-sea-sk-date" /></td>
      <td><Skeleton className="import-sea-sk-container" /></td>
      <td><Skeleton className="import-sea-sk-date" /></td>
      <td><Skeleton className="import-sea-sk-date" /></td>
      <td><Skeleton className="import-sea-sk-date" /></td>
      <td><Skeleton className="import-sea-sk-date" /></td>
      <td><Skeleton className="import-sea-sk-hold" /></td>
      <td><Skeleton className="import-sea-sk-handler rounded-full" /></td>
      <td>
        <Skeleton className={`import-sea-sk-status import-sea-sk-status--${index % 3}`} />
      </td>
    </tr>
  )
}

export default function ImportSeaBoardTableSkeleton() {
  return (
    <>
      {Array.from({ length: ROW_COUNT }, (_, i) => (
        <SkeletonRow key={i} index={i} />
      ))}
    </>
  )
}
