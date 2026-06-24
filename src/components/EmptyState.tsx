export default function EmptyState({ title = 'No data yet', detail }: { title?: string; detail?: string }) {
  return (
    <div className="empty-state">
      <p className="empty-state__title">{title}</p>
      {detail && <p className="empty-state__detail">{detail}</p>}
    </div>
  )
}
