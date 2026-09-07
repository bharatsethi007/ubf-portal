import { useState } from 'react'
import { Handshake, Headset, Megaphone, Ship, TrendingUp, Users } from 'lucide-react'
import VolumesLanesTab from './VolumesLanesTab'
import CustomerInsightsTab from './CustomerInsightsTab'
import SalesAnalyticsTab from './SalesAnalyticsTab'
import CustomerServiceTab from './cs/CustomerServiceTab'
import AgentReciprocityTab from './AgentReciprocityTab'
import MarketingTab from './MarketingTab'

type Tab = 'volumes' | 'customers' | 'sales' | 'cs' | 'agents' | 'marketing'

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('volumes')
  return (
    <div className="quotes-page">
      <div className="quotes-page__head">
        <h1>Reports</h1>
      </div>
      <div className="quotes-tabs">
        <button className={`quotes-tabs__btn${tab === 'volumes' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('volumes')}>
          <span className="inline-flex items-center gap-1.5">
            <Ship size={16} aria-hidden />
            Volumes &amp; Lanes
          </span>
        </button>
        <button className={`quotes-tabs__btn${tab === 'customers' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('customers')}>
          <span className="inline-flex items-center gap-1.5">
            <Users size={16} aria-hidden />
            Customer Insights
          </span>
        </button>
        <button className={`quotes-tabs__btn${tab === 'sales' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('sales')}>
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp size={16} aria-hidden />
            Sales analytics
          </span>
        </button>
        <button className={`quotes-tabs__btn${tab === 'cs' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('cs')}>
          <span className="inline-flex items-center gap-1.5">
            <Headset size={16} aria-hidden />
            Customer Service
          </span>
        </button>
        <button className={`quotes-tabs__btn${tab === 'agents' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('agents')}>
          <span className="inline-flex items-center gap-1.5">
            <Handshake size={16} aria-hidden />
            Agents
          </span>
        </button>
        <button className={`quotes-tabs__btn${tab === 'marketing' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('marketing')}>
          <span className="inline-flex items-center gap-1.5">
            <Megaphone size={16} aria-hidden />
            Marketing
          </span>
        </button>
      </div>
      {tab === 'volumes' ? <VolumesLanesTab /> : null}
      {tab === 'customers' ? <CustomerInsightsTab /> : null}
      {tab === 'sales' ? <SalesAnalyticsTab /> : null}
      {tab === 'cs' ? <CustomerServiceTab /> : null}
      {tab === 'agents' ? <AgentReciprocityTab /> : null}
      {tab === 'marketing' ? <MarketingTab /> : null}
    </div>
  )
}
