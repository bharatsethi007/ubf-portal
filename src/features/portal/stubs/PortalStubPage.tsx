import { Link } from 'react-router-dom'

type Props = { title: string }

export default function PortalStubPage({ title }: Props) {
  return (
    <div className="portal-card" style={{ padding: 48, textAlign: 'center' }}>
      <h1 className="portal-heading" style={{ fontSize: 22 }}>{title}</h1>
      <p style={{ color: 'var(--portal-muted)', marginTop: 10 }}>Coming soon in the customer portal.</p>
      <Link to="/portal" className="portal-btn-primary" style={{ marginTop: 24, display: 'inline-flex', textDecoration: 'none' }}>
        Back to dashboard
      </Link>
    </div>
  )
}
