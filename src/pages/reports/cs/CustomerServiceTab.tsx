import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import ComplaintsPanel from './ComplaintsPanel'
import CsatPanel from './CsatPanel'

export default function CustomerServiceTab() {
  return (
    <div className="card quotes-page__card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header className="quotes-page__head">
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Customer Service</h2>
      </header>

      <Tabs defaultValue="complaints" className="flex flex-col gap-4 cs-subtabs">
        <style>{`
          .cs-subtabs .quotes-tabs__btn[data-active] { color: var(--color-accent); }
          .cs-subtabs .quotes-tabs__btn[data-active]::after { opacity: 1; transform: scaleX(1); }
        `}</style>
        <TabsList className="quotes-tabs !inline-flex !h-auto !rounded-none !bg-transparent !p-0 !gap-0 w-full justify-start border-0">
          <TabsTrigger value="complaints" className="quotes-tabs__btn !rounded-none !shadow-none !bg-transparent !border-0 !px-[14px] !py-2 !text-[13px] !font-medium">
            Complaints
          </TabsTrigger>
          <TabsTrigger value="csat" className="quotes-tabs__btn !rounded-none !shadow-none !bg-transparent !border-0 !px-[14px] !py-2 !text-[13px] !font-medium">
            CSAT
          </TabsTrigger>
        </TabsList>
        <TabsContent value="complaints" className="mt-0">
          <ComplaintsPanel />
        </TabsContent>
        <TabsContent value="csat" className="mt-0">
          <CsatPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
