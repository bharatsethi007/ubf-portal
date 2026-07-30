import { RefreshCw, Save } from 'lucide-react'
import type { ExchangeRate } from './fxRatesApi'
import { ACCENT, correctedBuy, correctedSell, formatRate } from './exchangeRatesUtils'

type Props = {
  base: string
  pairs: ExchangeRate[]
  saving: boolean
  refreshing: boolean
  updatedLabel: string | null
  onPairsChange: (pairs: ExchangeRate[]) => void
  onSave: () => void
  onRefresh: () => void
}

export default function ExchangeRatesPairGrid({
  base, pairs, saving, refreshing, updatedLabel, onPairsChange, onSave, onRefresh,
}: Props) {
  const visible = pairs.filter((p) => p.quote_currency !== base)

  function updatePair(quote: string, patch: Partial<Pick<ExchangeRate, 'buy_correction_pct' | 'sell_correction_pct'>>) {
    onPairsChange(pairs.map((p) => (
      p.quote_currency === quote ? { ...p, ...patch } : p
    )))
  }

  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: ACCENT }}>
          Rate corrections — {base}
        </h2>
        <button
          type="button"
          className="nqd-btn nqd-btn--accent"
          style={{ background: ACCENT, borderColor: ACCENT }}
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw size={14} /> {refreshing ? 'Refreshing…' : 'Refresh rates'}
        </button>
      </div>
      <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--muted-foreground)' }}>
        Mid rate = units of base per 1 unit of quote. Buy/Sell apply correction % to the mid rate.
      </p>
      {updatedLabel && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted-foreground)' }}>
          Last updated {updatedLabel}
        </p>
      )}
      {visible.length === 0 ? (
        <p className="text-muted-foreground" style={{ fontSize: 13 }}>
          No rate pairs for {base} yet — refresh rates or check the currency is active.
        </p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Quote</th>
                  <th>Mid</th>
                  <th>Buy corr %</th>
                  <th>Sell corr %</th>
                  <th>Buy</th>
                  <th>Sell</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.quote_currency}>
                    <td className="mono">{p.quote_currency}</td>
                    <td className="mono">{formatRate(p.rate)}</td>
                    <td>
                      <input
                        className="input input--sm"
                        type="number"
                        step="0.01"
                        value={p.buy_correction_pct}
                        onChange={(e) => updatePair(p.quote_currency, { buy_correction_pct: Number(e.target.value) || 0 })}
                        style={{ width: 72 }}
                      />
                    </td>
                    <td>
                      <input
                        className="input input--sm"
                        type="number"
                        step="0.01"
                        value={p.sell_correction_pct}
                        onChange={(e) => updatePair(p.quote_currency, { sell_correction_pct: Number(e.target.value) || 0 })}
                        style={{ width: 72 }}
                      />
                    </td>
                    <td className="mono">{formatRate(correctedBuy(p.rate, p.buy_correction_pct))}</td>
                    <td className="mono">{formatRate(correctedSell(p.rate, p.sell_correction_pct))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="nqd-btn nqd-btn--accent"
            style={{ background: ACCENT, borderColor: ACCENT, marginTop: 8 }}
            disabled={saving}
            onClick={onSave}
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save corrections'}
          </button>
        </>
      )}
    </section>
  )
}
