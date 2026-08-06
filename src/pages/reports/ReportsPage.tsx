import { useState } from 'react'
import ExportAirTab from './ExportAirTab'
import VolumesLanesTab from './VolumesLanesTab'

type Tab = 'expair' | 'volumes' | 'customers' | 'lapsed'

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('expair')
  return (
    <div className="quotes-page">
      <div className="quotes-page__head">
        <h1>Reports</h1>
      </div>
      <div className="quotes-tabs">
        <button className={`quotes-tabs__btn${tab === 'expair' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('expair')}>Export Air</button>
        <button className={`quotes-tabs__btn${tab === 'volumes' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('volumes')}>Volumes &amp; Lanes</button>
        <button className={`quotes-tabs__btn${tab === 'customers' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('customers')}>Customers</button>
        <button className={`quotes-tabs__btn${tab === 'lapsed' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('lapsed')}>Lapsed customers</button>
      </div>
      {tab === 'expair' ? <ExportAirTab /> : null}
      {tab === 'volumes' ? <VolumesLanesTab /> : null}
      {tab === 'customers' ? <div className="pad-inline text-muted-foreground">Coming next.</div> : null}
      {tab === 'lapsed' ? <div className="pad-inline text-muted-foreground">Coming next.</div> : null}
    </div>
  )
}
