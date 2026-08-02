import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function RateModulePage({ title }: { title: string }) {
  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <Link
            to="/setup/rates"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted-foreground)', textDecoration: 'none', marginBottom: 8 }}
          >
            <ArrowLeft size={15} /> Rates
          </Link>
          <h1>{title}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted-foreground)', fontSize: 14 }}>
            This module is coming soon.
          </p>
        </header>
      </div>
    </div>
  )
}
