import type { ShipmentTask } from '../portalShipmentDetailTypes'

function dotColor(sev: 'high' | 'med'): string {
  return sev === 'high' ? 'var(--portal-orange)' : 'var(--portal-amber)'
}

type Props = { tasks: ShipmentTask[] }

export default function TaskTab({ tasks }: Props) {
  if (!tasks.length) {
    return <p className="portal-empty">No outstanding tasks.</p>
  }

  return (
    <ul className="portal-task-list">
      {tasks.map((t) => (
        <li key={t.id} className="portal-task-list__item">
          <span className="portal-attn-dot" style={{ background: dotColor(t.sev) }} aria-hidden />
          <span>{t.label}</span>
        </li>
      ))}
    </ul>
  )
}
