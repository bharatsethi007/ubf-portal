import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  listCartageZones,
  listCartageBands,
  listCartageSurcharges,
  listCartageFaf,
  type CartageZone,
  type CartageBand,
  type CartageSurcharge,
  type CartageFaf,
} from './cartageApi'

type Tab = 'zones' | 'bands' | 'surcharges' | 'faf'

const TAB_TRIGGER_CLASS =
  'quotes-tabs__btn !rounded-none !shadow-none !bg-transparent !border-0 !px-[14px] !py-2 !text-[13px] !font-medium'

export default function CartageSetupPage() {
  const [tab, setTab] = useState<Tab>('zones')
  const [zones, setZones] = useState<CartageZone[]>([])
  const [bands, setBands] = useState<CartageBand[]>([])
  const [surcharges, setSurcharges] = useState<CartageSurcharge[]>([])
  const [faf, setFaf] = useState<CartageFaf[]>([])

  useEffect(() => {
    Promise.all([listCartageZones(), listCartageBands(), listCartageSurcharges(), listCartageFaf()])
      .then(([z, b, s, f]) => {
        setZones(z)
        setBands(b)
        setSurcharges(s)
        setFaf(f)
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load cartage setup'))
  }, [])

  const tabs = useMemo(
    () =>
      [
        { id: 'zones' as const, label: `Zones (${zones.length})` },
        { id: 'bands' as const, label: `Weight Bands (${bands.length})` },
        { id: 'surcharges' as const, label: `Surcharges (${surcharges.length})` },
        { id: 'faf' as const, label: `Monthly FAF (${faf.length})` },
      ] satisfies { id: Tab; label: string }[],
    [zones.length, bands.length, surcharges.length, faf.length],
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

          <TabsContent value="zones" className="mt-0">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Island</th>
                    <th>Region</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground pad-inline">
                        No zones yet. Import via CSV.
                      </td>
                    </tr>
                  ) : (
                    zones.map((z) => (
                      <tr key={z.id}>
                        <td>{z.zone_code}</td>
                        <td>{z.name}</td>
                        <td>{z.zone_type}</td>
                        <td>{z.island ?? '-'}</td>
                        <td>{z.region ?? '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="bands" className="mt-0">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Label</th>
                    <th>Min kg</th>
                    <th>Max kg</th>
                  </tr>
                </thead>
                <tbody>
                  {bands.map((b) => (
                    <tr key={b.id}>
                      <td>{b.band_code}</td>
                      <td>{b.label}</td>
                      <td>{b.min_kg}</td>
                      <td>{b.max_kg ?? '+'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="surcharges" className="mt-0">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Label</th>
                    <th>Applies</th>
                    <th>Calc</th>
                    <th>Tiers</th>
                  </tr>
                </thead>
                <tbody>
                  {surcharges.map((s) => (
                    <tr key={s.id}>
                      <td>{s.code}</td>
                      <td>{s.label}</td>
                      <td>{s.applies_to}</td>
                      <td>{s.calc}</td>
                      <td>
                        {s.cartage_surcharge_tiers?.map((t) => `${t.threshold_kg / 1000}t`).join(', ') || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="faf" className="mt-0">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Percent</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {faf.map((f) => (
                    <tr key={f.id}>
                      <td>{f.effective_month}</td>
                      <td>{f.percent}%</td>
                      <td>{f.note ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
