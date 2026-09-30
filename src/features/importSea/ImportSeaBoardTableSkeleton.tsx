import { Skeleton } from '@/components/ui/skeleton'

const ROW_COUNT = 12

/** Loading rows that always match the live column count. */
export default function ImportSeaBoardTableSkeleton({ colSpan = 18 }: { colSpan?: number }) {
  return (
    <>
      {Array.from({ length: ROW_COUNT }, (_, r) => (
        <tr key={r} className="import-sea-sk-row" aria-hidden>
          {Array.from({ length: colSpan }, (_, c) => (
            <td key={c}>
              {c === 0 ? null : <Skeleton className={c === 3 ? 'import-sea-sk-client' : 'import-sea-sk-date'} />}
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
