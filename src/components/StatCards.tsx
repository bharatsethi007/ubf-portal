import type { StatCounts } from '../types/shipment'

type Card = { key: keyof StatCounts; label: string; highlight?: boolean }

const CARDS: Card[] = [
  { key: 'total', label: 'Total Shipments', highlight: true },
  { key: 'notYetDeparted', label: 'Not Yet Departed' },
  { key: 'inTransit', label: 'In Transit' },
  { key: 'arrivingIn7Days', label: 'Arriving In 7 Days' },
  { key: 'watchlist', label: 'Watchlist' },
]

export default function StatCards({ stats }: { stats: StatCounts }) {
  return (
    <div className="stat-cards">
      {CARDS.map(({ key, label, highlight }) => (
        <div key={key} className={`stat-card${highlight ? ' stat-card--highlight' : ''}`}>
          <span className="stat-card__value">{stats[key]}</span>
          <span className="stat-card__label">{label}</span>
        </div>
      ))}
    </div>
  )
}
