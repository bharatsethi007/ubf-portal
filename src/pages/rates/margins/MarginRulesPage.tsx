import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import CustomerPicker, { type CustomerPickerValue } from '@/components/bookings/CustomerPicker'
import MarginRuleRow from './MarginRuleRow'
import { PRODUCTS, listMarginRules, listRecentSearches, type MarginRule, type Product, type RateSearch } from './marginRulesApi'

const HEAD = (
  <thead>
    <tr><th>Applies to</th><th>Method</th><th>Margin</th><th>Minimum margin</th><th>Active</th><th /></tr>
  </thead>
)

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/** Staff: how portal rate searches turn buy rates into the sell prices customers see. */
export default function MarginRulesPage() {
  const [rules, setRules] = useState<MarginRule[]>([])
  const [searches, setSearches] = useState<RateSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [cust, setCust] = useState<CustomerPickerValue | null>(null)
  const [newProduct, setNewProduct] = useState<Product>('FCL')

  const load = useCallback(async () => {
    setLoading(true)
    const [r, s] = await Promise.all([listMarginRules().catch(() => []), listRecentSearches()])
    setRules(r)
    setSearches(s)
    setLoading(false)
    setTick((t) => t + 1)
  }, [])

  useEffect(() => { void load() }, [load])

  const defaults = rules.filter((r) => r.account_id == null)
  const overrides = rules.filter((r) => r.account_id != null)

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <div>
            <Link to="/setup/rates" className="text-muted-foreground" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <ArrowLeft size={14} /> Rates
            </Link>
            <h1 style={{ marginTop: 4 }}>Customer margins</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--muted-foreground)', fontSize: 14, maxWidth: 760 }}>
              Customers searching rates on the portal only ever see sell prices. For each rate line the price comes from the
              first of: a customer margin below, a sell rate typed on the line, the line or card markup, then the default margin.
              A line with none of these shows as <b>price on request</b>.
            </p>
          </div>
        </header>

        <section style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>Default margins</h2>
          <div className="table-wrap">
            <table className="data-table">
              {HEAD}
              <tbody key={`d${tick}`}>
                {PRODUCTS.map((p) => (
                  <MarginRuleRow key={p.v} product={p.v} accountId={null} label={p.label} sub="All customers"
                    rule={defaults.find((r) => r.product === p.v) ?? null} onSaved={() => void load()} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>Customer margins</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 10 }}>
            <div style={{ minWidth: 320 }}><CustomerPicker label="Add a margin for" value={cust} onChange={setCust} compact /></div>
            <select className="input input--sm" value={newProduct} onChange={(e) => setNewProduct(e.target.value as Product)} aria-label="Product">
              {PRODUCTS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              {HEAD}
              <tbody key={`o${tick}`}>
                {cust && !overrides.some((r) => r.account_id === cust.account_id && r.product === newProduct) && (
                  <MarginRuleRow key={`new-${cust.account_id}-${newProduct}`} product={newProduct} accountId={cust.account_id}
                    label={`${cust.name} · ${PRODUCTS.find((p) => p.v === newProduct)?.label}`} sub="New" rule={null}
                    onSaved={() => { setCust(null); void load() }} />
                )}
                {overrides.map((r) => (
                  <MarginRuleRow key={r.id} product={r.product} accountId={r.account_id} rule={r}
                    label={`${r.customers?.name ?? r.account_id} · ${PRODUCTS.find((p) => p.v === r.product)?.label}`} sub={r.account_id ?? undefined}
                    onSaved={() => void load()} />
                ))}
                {!loading && overrides.length === 0 && !cust && (
                  <tr><td colSpan={6} className="text-muted-foreground pad-inline">No customer margins yet. Pick a customer above to set special pricing.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>Recent portal searches</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>When</th><th>Customer</th><th>Lane</th><th>Service</th><th>Options</th><th>Priced</th></tr></thead>
              <tbody>
                {searches.map((s) => (
                  <tr key={s.id}>
                    <td>{fmtWhen(s.searched_at)}</td>
                    <td className="mono">{s.account_id}</td>
                    <td className="mono">{s.origin} → {s.destination}</td>
                    <td>{[s.mode === 'air' ? 'Air' : 'Sea', s.load_type, s.container_type].filter(Boolean).join(' · ')}</td>
                    <td>{s.results ?? 0}</td>
                    <td style={{ color: s.results && !s.priced ? '#b45309' : undefined }}>{s.priced ?? 0}</td>
                  </tr>
                ))}
                {!loading && searches.length === 0 && (
                  <tr><td colSpan={6} className="text-muted-foreground pad-inline">No customer searches yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
