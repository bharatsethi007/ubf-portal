import type { Container } from '../../../types/container'
import EmptyTab from './EmptyTab'

type Props = { containers: Container[] }

export default function ContainersTab({ containers }: Props) {
  if (containers.length === 0) {
    return <EmptyTab title="No containers" hint="Containers appear when the linked consol has box numbers." />
  }

  return (
    <ul className="space-y-2 px-1">
      {containers.map((c) => (
        <li
          key={c.c_number}
          className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
        >
          <div>
            <div className="nums text-[13px] font-medium">{c.c_number}</div>
            <div className="text-xs text-muted-foreground">
              {[c.container_size, c.seal ? `Seal ${c.seal}` : null].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {c.avail_from || c.avail_to
              ? `${c.avail_from?.slice(0, 10) ?? '—'} → ${c.avail_to?.slice(0, 10) ?? '—'}`
              : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
