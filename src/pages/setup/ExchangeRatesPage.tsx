import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import ExchangeRatesPairGrid from './ExchangeRatesPairGrid'
import { ACCENT, lastUpdatedLabel, pairsEqual } from './exchangeRatesUtils'
import {
  deleteCurrency,
  fetchCurrencies,
  fetchExchangeRates,
  fetchFxSyncState,
  fetchRatesForBase,
  refreshFxRates,
  setCurrencyActive,
  updatePairCorrection,
  upsertCurrency,
  type ExchangeRate,
  type FxSyncState,
  type SetupCurrency,
} from './fxRatesApi'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label="Active" />
  )
}

export default function ExchangeRatesPage() {
  const [currencies, setCurrencies] = useState<SetupCurrency[]>([])
  const [allRates, setAllRates] = useState<ExchangeRate[]>([])
  const [syncState, setSyncState] = useState<FxSyncState | null>(null)
  const [selectedBase, setSelectedBase] = useState<string | null>(null)
  const [pairs, setPairs] = useState<ExchangeRate[]>([])
  const [savedPairs, setSavedPairs] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingPairs, setSavingPairs] = useState(false)
  const [newCurrency, setNewCurrency] = useState({ code: '', name: '', symbol: '' })

  const reloadMeta = useCallback(async () => {
    const [c, r, s] = await Promise.all([fetchCurrencies(), fetchExchangeRates(), fetchFxSyncState()])
    setCurrencies(c)
    setAllRates(r)
    setSyncState(s)
  }, [])

  const loadPairs = useCallback(async (base: string) => {
    const rows = await fetchRatesForBase(base)
    setPairs(rows)
    setSavedPairs(rows)
  }, [])

  useEffect(() => {
    reloadMeta()
      .catch(() => toast.error('Failed to load exchange rates'))
      .finally(() => setLoading(false))
  }, [reloadMeta])

  useEffect(() => {
    if (!selectedBase) {
      setPairs([])
      setSavedPairs([])
      return
    }
    loadPairs(selectedBase).catch(() => toast.error('Failed to load rate pairs'))
  }, [selectedBase, loadPairs])

  async function saveCurrencyRow(row: SetupCurrency) {
    try {
      await upsertCurrency(row)
      await reloadMeta()
      toast.success('Currency saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function toggleActive(row: SetupCurrency, active: boolean) {
    try {
      await setCurrencyActive(row.code, active)
      setCurrencies((rows) => rows.map((r) => r.code === row.code ? { ...r, active } : r))
      toast.success(active ? 'Currency activated' : 'Currency deactivated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  async function onDeleteCurrency(code: string) {
    if (!window.confirm(`Delete ${code}? This removes all exchange-rate rows involving ${code}.`)) return
    try {
      await deleteCurrency(code)
      if (selectedBase === code) setSelectedBase(null)
      await reloadMeta()
      toast.success('Currency deleted')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  async function onAddCurrency() {
    const code = newCurrency.code.trim().toUpperCase()
    const name = newCurrency.name.trim()
    if (!code || !name) {
      toast.error('ISO code and name are required')
      return
    }
    const loadingId = toast.loading(`Adding ${code} and pulling rates…`)
    try {
      await upsertCurrency({ code, name, symbol: newCurrency.symbol.trim() || null, active: true })
      await refreshFxRates()
      await reloadMeta()
      const basePairs = await fetchRatesForBase(code)
      setSelectedBase(code)
      setPairs(basePairs)
      setSavedPairs(basePairs)
      toast.dismiss(loadingId)
      if (basePairs.length === 0) {
        toast.warning(`No rates found for ${code} — check the ISO code.`)
      } else {
        toast.success(`${code} added and rates loaded`)
      }
      setNewCurrency({ code: '', name: '', symbol: '' })
    } catch (e) {
      toast.dismiss(loadingId)
      toast.error(e instanceof Error ? e.message : 'Could not add currency')
    }
  }

  async function onRefreshRates() {
    setRefreshing(true)
    const loadingId = toast.loading('Fetching latest rates…')
    try {
      const message = await refreshFxRates()
      await reloadMeta()
      if (selectedBase) await loadPairs(selectedBase)
      toast.dismiss(loadingId)
      toast.success(message)
    } catch (e) {
      toast.dismiss(loadingId)
      toast.error(e instanceof Error ? e.message : 'Could not refresh rates')
    } finally {
      setRefreshing(false)
    }
  }

  async function onSaveCorrections() {
    const changed = pairs.filter((p) => {
      const orig = savedPairs.find((s) => s.quote_currency === p.quote_currency)
      return orig && (
        orig.buy_correction_pct !== p.buy_correction_pct
        || orig.sell_correction_pct !== p.sell_correction_pct
      )
    })
    if (changed.length === 0) {
      toast.message('No correction changes to save')
      return
    }
    setSavingPairs(true)
    try {
      await Promise.all(changed.map((p) => updatePairCorrection(
        p.base_currency,
        p.quote_currency,
        p.buy_correction_pct,
        p.sell_correction_pct,
      )))
      await loadPairs(selectedBase!)
      await reloadMeta()
      toast.success('Corrections saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save corrections')
    } finally {
      setSavingPairs(false)
    }
  }

  const updatedLabel = lastUpdatedLabel(allRates, syncState)
  const hasPairChanges = !pairsEqual(pairs, savedPairs)

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <Link to="/setup" style={{ color: ACCENT, fontSize: 13, textDecoration: 'none' }}>← Setup</Link>
        <header className="quotes-page__head" style={{ marginTop: 8 }}>
          <h1>Exchange rates</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted-foreground)', fontSize: 13 }}>
            Manage currencies, daily mid rates, and per-pair buy/sell corrections.
          </p>
        </header>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <>
            <h2 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 600, color: ACCENT }}>Currencies</h2>
            <div className="table-wrap">
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Code</th><th>Name</th><th>Symbol</th><th>Active</th><th />
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: 'var(--color-canvas)' }}>
                    <td>
                      <input
                        className="input input--sm mono"
                        placeholder="ISO"
                        maxLength={3}
                        value={newCurrency.code}
                        onChange={(e) => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })}
                        style={{ width: 56 }}
                      />
                    </td>
                    <td>
                      <input
                        className="input input--sm"
                        placeholder="Name"
                        value={newCurrency.name}
                        onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="input input--sm"
                        placeholder="Symbol"
                        value={newCurrency.symbol}
                        onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                        style={{ width: 56 }}
                      />
                    </td>
                    <td colSpan={2}>
                      <button
                        type="button"
                        className="nqd-btn nqd-btn--accent"
                        style={{ background: ACCENT, borderColor: ACCENT }}
                        onClick={onAddCurrency}
                      >
                        <Plus size={14} /> Add
                      </button>
                    </td>
                  </tr>
                  {currencies.map((c) => (
                    <tr key={c.code} style={selectedBase === c.code ? { background: 'var(--color-canvas)' } : undefined}>
                      <td className="mono">{c.code}</td>
                      <td>
                        <input
                          className="input input--sm"
                          value={c.name}
                          onChange={(e) => setCurrencies((rows) => rows.map((r) => (
                            r.code === c.code ? { ...r, name: e.target.value } : r
                          )))}
                          onBlur={(e) => saveCurrencyRow({ ...c, name: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="input input--sm"
                          value={c.symbol ?? ''}
                          onChange={(e) => setCurrencies((rows) => rows.map((r) => (
                            r.code === c.code ? { ...r, symbol: e.target.value || null } : r
                          )))}
                          onBlur={(e) => saveCurrencyRow({ ...c, symbol: e.target.value.trim() || null })}
                          style={{ width: 56 }}
                        />
                      </td>
                      <td>
                        <Toggle checked={c.active} onChange={(active) => toggleActive(c, active)} />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit corrections for ${c.code}`}
                          onClick={() => setSelectedBase(c.code)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Delete ${c.code}`}
                          onClick={() => onDeleteCurrency(c.code)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedBase ? (
              <ExchangeRatesPairGrid
                base={selectedBase}
                pairs={pairs}
                saving={savingPairs}
                refreshing={refreshing}
                updatedLabel={updatedLabel}
                onPairsChange={setPairs}
                onSave={onSaveCorrections}
                onRefresh={onRefreshRates}
              />
            ) : (
              <p style={{ marginTop: 20, fontSize: 13, color: 'var(--muted-foreground)' }}>
                Select Edit on a currency to adjust buy/sell corrections per quote pair.
              </p>
            )}

            {hasPairChanges && selectedBase && (
              <p style={{ marginTop: 8, fontSize: 12, color: ACCENT }}>Unsaved correction changes</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
