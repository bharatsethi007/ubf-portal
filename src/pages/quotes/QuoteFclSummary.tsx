import { ArrowRight, Globe } from 'lucide-react'
import { useSeaPorts } from '../../hooks/useSeaPorts'
import type { QuoteRecord } from './quotesApi'
import type { QuoteContainer } from './quoteContainersApi'
import './quoteFclSummary.css'

const SIZE_LABEL: Record<string, string> = { '20': '20ft', '40': '40ft', '40HC': '40ft HC', '45HC': '45ft HC' }
const TYPE_LABEL: Record<string, string> = {
  standard: 'Standard (dry)', reefer: 'Reefer', opentop: 'Open top',
  flatrack: 'Flat rack', isotank: 'ISO tank', openside: 'Open side',
}

function PortTile({ code, name, cc }: { code: string | null; name: string; cc: string | null }) {
  if (!code) {
    return (
      <div className="qfcl-port">
        <Globe size={22} className="qfcl-port__globe" aria-hidden />
        <div className="qfcl-port__block"><span className="qfcl-port__code">—</span></div>
      </div>
    )
  }
  return (
    <div className="qfcl-port">
      {cc ? (
        <span className={`fi fi-${cc} qfcl-port__flag`} aria-hidden />
      ) : (
        <Globe size={22} className="qfcl-port__globe" aria-hidden />
      )}
      <div className="qfcl-port__block">
        <span className="qfcl-port__code mono">{code}</span>
        <span className="qfcl-port__name">{name}</span>
      </div>
    </div>
  )
}

export default function QuoteFclSummary({
  quote,
  containers,
}: {
  quote: QuoteRecord
  containers: QuoteContainer[]
}) {
  const { ports } = useSeaPorts()
  const resolve = (code: string | null) => {
    if (!code) return { code, name: '—', cc: null as string | null }
    const p = ports.find((x) => x.code === code)
    return { code, name: p?.name ?? code, cc: p?.country_code ?? null }
  }
  const from = resolve(quote.from_port_code)
  const to = resolve(quote.to_port_code)

  return (
    <>
      <section className="card booking-form-card quote-form__section">
        <h2 className="booking-form-card__title">Lane</h2>
        <div className="booking-form-card__body">
          <div className="qfcl-lane">
            <PortTile code={from.code} name={from.name} cc={from.cc} />
            <ArrowRight size={20} className="qfcl-lane__arrow" aria-hidden />
            <PortTile code={to.code} name={to.name} cc={to.cc} />
            <div className="qfcl-badges">
              <span className="qfcl-badge">Sea</span>
              <span className="qfcl-badge">FCL</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card booking-form-card quote-form__section">
        <h2 className="booking-form-card__title">Containers</h2>
        <div className="booking-form-card__body">
          {containers.length === 0 ? (
            <p className="qfcl-empty">No containers on this quote.</p>
          ) : (
            <div className="qfcl-containers">
              {containers.map((c) => (
                <div className="qfcl-cgroup" key={c.id}>
                  <span className="qfcl-cgroup__qty">{c.qty} ×</span>
                  <div className="qfcl-cgroup__main">
                    <span className="qfcl-cgroup__size">{SIZE_LABEL[c.container_size] ?? c.container_size}</span>
                    <span className="qfcl-cgroup__type">{TYPE_LABEL[c.container_type] ?? c.container_type}</span>
                  </div>
                  <div className="qfcl-cgroup__meta">
                    {c.weight_per_container_mt != null && <div>{c.weight_per_container_mt} MT / ctr</div>}
                    <div>{c.commodity ?? 'General'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
