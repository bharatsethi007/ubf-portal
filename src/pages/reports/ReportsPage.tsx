import { useState } from 'react'
import VolumesLanesTab from './VolumesLanesTab'

type Tab = 'volumes' | 'customers' | 'sales'

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('volumes')
  return (
    <div className="quotes-page">
      <div className="quotes-page__head">
        <h1>Reports</h1>
      </div>
      <div className="quotes-tabs">
        <button className={`quotes-tabs__btn${tab === 'volumes' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('volumes')}>Volumes &amp; Lanes</button>
        <button className={`quotes-tabs__btn${tab === 'customers' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('customers')}>Customers</button>
        <button className={`quotes-tabs__btn${tab === 'sales' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('sales')}>Sales analytics</button>
      </div>
      {tab === 'volumes' ? <VolumesLanesTab /> : null}
      {tab === 'customers' ? <div className="pad-inline text-muted-foreground">Coming next.</div> : null}
      {tab === 'sales' ? <div className="pad-inline text-muted-foreground">Coming next.</div> : null}
    </div>
  )
}
