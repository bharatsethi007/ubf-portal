import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrencies } from '../../hooks/useQuoteRefData'
import {
  deleteFxMargin,
  fetchExchangeRates,
  fetchFxMargins,
  fetchFxSyncState,
  refreshFxRates,
  upsertFxMargin,
  type ExchangeRate,
  type FxMargin,
  type FxSyncState,
} from './fxRatesApi'

const ACCENT = '#3B5BFE'

function marginLabel(currency: string): string {
  return currency === '*' ? 'Global default' : currency
}

function formatRate(rate: number): string {
  return Number.isFinite(rate) ? rate.toFixed(4) : '—'
}

function lastUpdatedLabel(rates: ExchangeRate[], sync: FxSyncState | null): string | null {
  if (rates.length > 0) {
    return rates.reduce((max, r) => (r.as_of > max ? r.as_of : max), rates[0].as_of)
  }
  if (sync?.last_applied_at) {
    return new Date(sync.last_applied_at).toLocaleString()
  }
  return null
}

export default function ExchangeRatesPage() {
  const { items: currencies } = useCurrencies()
  const [margins, setMargins] = useState<FxMargin[]>([])
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [syncState, setSyncState] = useState<FxSyncState | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [newMargin, setNewMargin] = useState({ currency: '', margin_pct: 0 })

  const reload = useCallback(async () => {
    const [m, r, s] = await Promise.all([fetchFxMargins(), fetchExchangeRates(), fetchFxSyncState()])
    setMargins(m)
    setRates(r)
    setSyncState(s)
  }, [])

  useEffect(() => {
    reload()
      .catch(() => toast.error('Failed to load exchange rates'))
      .finally(() => setLoading(false))
  }, [reload])

  const usedCurrencies = useMemo(() => new Set(margins.map((m) => m.currency)), [margins])
  const availableCurrencies = useMemo(
    () => currencies.filter((c) => !usedCurrencies.has(c.code)),
    [currencies, usedCurrencies],
  )

  useEffect(() => {
    if (newMargin.currency && usedCurrencies.has(newMargin.currency)) return
    if (!newMargin.currency && availableCurrencies.length > 0) {
      setNewMargin((prev) => ({ ...prev, currency: availableCurrencies[0].code }))
    }
  }, [availableCurrencies, newMargin.currency, usedCurrencies])

  async function run(action: () => Promise<void>, ok: string) {
    try {
      await action()
      await reload()
      toast.success(ok)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function saveMargin(row: FxMargin) {
    await run(() => upsertFxMargin(row.currency, row.margin_pct), 'Margin saved')
  }

  async function removeMargin(currency: string) {
    await run(() => deleteFxMargin(currency), 'Margin deleted')
  }

  async function addMargin() {
    const currency = newMargin.currency.trim()
    if (!currency) {
      toast.error('Select a currency')
      return
    }
    await run(() => upsertFxMargin(currency, newMargin.margin_pct), 'Margin added')
    setNewMargin({ currency: '', margin_pct: 0 })
  }

  async function onRefreshRates() {
    setRefreshing(true)
    const loadingId = toast.loading('Fetching latest rates…')
    try {
      const message = await refreshFxRates()
      await reload()
      toast.dismiss(loadingId)
      toast.success(message)
    } catch (e) {
      toast.dismiss(loadingId)
      toast.error(e instanceof Error ? e.message : 'Could not refresh rates')
    } finally {
      setRefreshing(false)
    }
  }

  const updatedLabel = lastUpdatedLabel(rates, syncState)

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <Link to="/setup" style={{ color: ACCENT, fontSize: 13, textDecoration: 'none' }}>← Setup</Link>
        <header className="quotes-page__head" style={{ marginTop: 8 }}>
          <h1>Exchange rates</h1>
        </header>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <>
            <h2 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 600, color: ACCENT }}>Margins</h2>
            <div className="table-wrap">
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Currency</th>
                    <th>Margin</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {margins.map((m) => (
                    <tr key={m.currency}>
                      <td className="mono">{marginLabel(m.currency)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            className="input input--sm"
                            type="number"
                            step="0.01"
                            value={m.margin_pct}
                            onChange={(e) => setMargins((rows) => rows.map((r) => (
                              r.currency === m.currency ? { ...r, margin_pct: Number(e.target.value) || 0 } : r
                            )))}
                            style={{ width: 88 }}
                          />
                          <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>%</span>
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="icon-btn" aria-label="Save margin" onClick={() => saveMargin(m)}>
                          <Save size={14} />
                        </button>
                        {m.currency !== '*' && (
                          <button type="button" className="icon-btn" aria-label="Delete margin" onClick={() => removeMargin(m.currency)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--color-canvas)' }}>
                    <td>
                      <select
                        className="input input--sm"
                        value={newMargin.currency}
                        onChange={(e) => setNewMargin({ ...newMargin, currency: e.target.value })}
                        disabled={availableCurrencies.length === 0}
                      >
                        {availableCurrencies.length === 0 ? (
                          <option value="">All currencies have margins</option>
                        ) : (
                          availableCurrencies.map((c) => (
                            <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                          ))
                        )}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          className="input input--sm"
                          type="number"
                          step="0.01"
                          value={newMargin.margin_pct}
                          onChange={(e) => setNewMargin({ ...newMargin, margin_pct: Number(e.target.value) || 0 })}
                          style={{ width: 88 }}
                        />
                        <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>%</span>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="nqd-btn nqd-btn--accent"
                        style={{ background: ACCENT, borderColor: ACCENT }}
                        onClick={addMargin}
                        disabled={availableCurrencies.length === 0}
                      >
                        <Plus size={14} /> Add
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 8px', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: ACCENT }}>Live rates</h2>
              <button
                type="button"
                className="nqd-btn nqd-btn--accent"
                style={{ background: ACCENT, borderColor: ACCENT }}
                disabled={refreshing}
                onClick={onRefreshRates}
              >
                <RefreshCw size={14} /> {refreshing ? 'Refreshing…' : 'Refresh rates'}
              </button>
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--muted-foreground)' }}>
              Rate = units of base per 1 unit of quote currency.
            </p>
            {updatedLabel && (
              <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted-foreground)' }}>
                Last updated {updatedLabel}
              </p>
            )}
            {!updatedLabel && <div style={{ marginBottom: 8 }} />}
            {rates.length === 0 ? (
              <p className="text-muted-foreground" style={{ fontSize: 13 }}>
                No rates yet — the daily sync will populate these (set up next).
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table data-table--compact">
                  <thead>
                    <tr>
                      <th>Base</th>
                      <th>Quote</th>
                      <th>Rate</th>
                      <th>As of</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((r) => (
                      <tr key={`${r.base_currency}-${r.quote_currency}`}>
                        <td className="mono">{r.base_currency}</td>
                        <td className="mono">{r.quote_currency}</td>
                        <td className="mono">{formatRate(r.rate)}</td>
                        <td>{r.as_of}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
