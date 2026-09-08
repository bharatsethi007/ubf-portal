import { useMemo, useState } from 'react'
import CartageZonesTab from './CartageZonesTab'
import CartageBandsTab from './CartageBandsTab'
import CartageSurchargesTab from './CartageSurchargesTab'
import CartageFafTab from './CartageFafTab'

type Tab = 'zones' | 'bands' | 'surcharges' | 'faf'

export default function CartageSetupPage() {
  const [tab, setTab] = useState<Tab>('zones')
  const [zonesCount, setZonesCount] = useState(0)
  const [bandsCount, setBandsCount] = useState(0)
  const [surchargesCount, setSurchargesCount] = useState(0)
  const [fafCount, setFafCount] = useState(0)

  const tabs = useMemo(
    () =>
      [
        { id: 'zones' as const, label: `Zones (${zonesCount})` },
        { id: 'bands' as const, label: `Weight Bands (${bandsCount})` },
        { id: 'surcharges' as const, label: `Surcharges (${surchargesCount})` },
        { id: 'faf' as const, label: `Monthly FAF (${fafCount})` },
      ] satisfies { id: Tab; label: string }[],
    [zonesCount, bandsCount, surchargesCount, fafCount],
  )

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <h1>Cartage Setup</h1>
        </header>

        <div className="quotes-tabs" role="tablist" aria-label="Cartage setup">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`quotes-tabs__btn${tab === t.id ? ' quotes-tabs__btn--on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'zones' && <CartageZonesTab onCount={setZonesCount} />}
        {tab === 'bands' && <CartageBandsTab onCount={setBandsCount} />}
        {tab === 'surcharges' && <CartageSurchargesTab onCount={setSurchargesCount} />}
        {tab === 'faf' && <CartageFafTab onCount={setFafCount} />}
      </div>
    </div>
  )
}
