const CHIPS = [
  'Live shipment tracking',
  'Invoices & payments',
  'Book air & sea',
]

export default function PortalLoginVisual() {
  return (
    <aside className="portal-login__visual" aria-hidden>
      <div className="portal-login__visual-dots" />
      <div className="portal-login__visual-content">
        <p className="portal-login__visual-tagline">Your cargo, in real time.</p>
        <p className="portal-login__visual-sub">
          Live tracking across NZ, Australia and the Pacific.
        </p>
        <ul className="portal-login__chips">
          {CHIPS.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
