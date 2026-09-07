import { useMemo, useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CartageZonesTab from './CartageZonesTab'
import CartageBandsTab from './CartageBandsTab'
import CartageSurchargesTab from './CartageSurchargesTab'
import CartageFafTab from './CartageFafTab'

type Tab = 'zones' | 'bands' | 'surcharges' | 'faf'

const TAB_TRIGGER_CLASS =
  'quotes-tabs__btn !rounded-none !shadow-none !bg-transparent !border-0 !px-[14px] !py-2 !text-[13px] !font-medium'

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

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          className="flex flex-col gap-4 cartage-setup-tabs"
        >
          <style>{`
            .cartage-setup-tabs .quotes-tabs__btn[data-active] { color: var(--color-accent); }
            .cartage-setup-tabs .quotes-tabs__btn[data-active]::after { opacity: 1; transform: scaleX(1); }
          `}</style>
          <TabsList className="quotes-tabs !inline-flex !h-auto !rounded-none !bg-transparent !p-0 !gap-0 w-full justify-start border-0">
            {tabs.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className={TAB_TRIGGER_CLASS}
                style={{ width: 'auto' }}
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {tab === 'zones' && <CartageZonesTab onCount={setZonesCount} />}
          {tab === 'bands' && <CartageBandsTab onCount={setBandsCount} />}
          {tab === 'surcharges' && <CartageSurchargesTab onCount={setSurchargesCount} />}
          {tab === 'faf' && <CartageFafTab onCount={setFafCount} />}
        </Tabs>
      </div>
    </div>
  )
}
