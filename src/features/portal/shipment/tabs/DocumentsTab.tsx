export default function DocumentsTab() {
  return (
    <div className="portal-detail-empty">
      <p className="portal-empty">No documents available for this shipment.</p>
      <p className="portal-detail-muted">
        Shipment documents are not synced to the portal yet. A future module will need a documents source and storage (similar to SLI documents).
      </p>
    </div>
  )
}
