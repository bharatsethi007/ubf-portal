import type { AttentionItem } from '../../dashboard/portalDashboardApi'
import SectionTitle from './SectionTitle'

type Props = { items: AttentionItem[] }

function dotColor(sev: 'high' | 'med'): string {
  return sev === 'high' ? 'var(--portal-orange)' : 'var(--portal-amber)'
}

export default function AttentionList({ items }: Props) {
  return (
    <div className="portal-card portal-card--pad">
      <SectionTitle title="Needs attention" />
      {items.length === 0 ? (
        <p className="portal-empty" style={{ padding: '12px 0' }}>No exceptions right now.</p>
      ) : (
        <ul className="portal-attn-list">
          {items.map((s) => (
            <li key={`${s.ref}-${s.flag}`} className="portal-attn-row">
              <span className="portal-attn-dot" style={{ background: dotColor(s.sev) }} />
              <div className="portal-attn-body">
                <div className="portal-attn-ref">{s.ref}</div>
                <div className="portal-attn-lane">{s.lane}</div>
                <div className="portal-attn-reason">{s.flag}</div>
              </div>
              <span className="portal-attn-eta nums">{s.eta}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
