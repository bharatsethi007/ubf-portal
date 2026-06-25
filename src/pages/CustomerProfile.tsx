import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../components/Customers/customerProfile.css'
import '../components/overdueBadge.css'
import {
  fetchCustomerStats,
  fetchCustomerInsights,
  type CustomerStats,
  type Insights,
} from '../components/Customers/customerProfileApi'
import { fetchCustomerOverdue, type CustomerOverdue } from '../api/customerOverdueApi'
import OverdueBadge from '../components/OverdueBadge'
import { CustomerOverviewTab } from '../components/Customers/CustomerOverviewTab'
import { CustomerShipmentsTab } from '../components/Customers/CustomerShipmentsTab'
import { CustomerInfoTab } from '../components/Customers/CustomerInfoTab'
import InvoicesTable from '../components/InvoicesTable'
import { useCustomerInvoices } from '../hooks/useInvoices'
import { KpiCard, fmt } from '../components/Customers/profileUi'

type Tab = 'overview' | 'shipments' | 'info' | 'invoices'

export default function CustomerProfile() {
  const { accountId } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<CustomerStats | null>(null)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [overdue, setOverdue] = useState<CustomerOverdue | null>(null)
  const [loading, setLoading] = useState(false)
  const { invoices, outstandingByCurrency, loading: invoicesLoading } = useCustomerInvoices(accountId ?? null)

  const load = useCallback((withInsights: boolean) => {
    if (!accountId) return
    setLoading(true)
    const jobs: Promise<unknown>[] = [
      fetchCustomerStats(accountId).then(setStats),
      fetchCustomerOverdue(accountId, 30).then(setOverdue),
    ]
    if (withInsights) jobs.push(fetchCustomerInsights(accountId).then(setInsights))
    Promise.all(jobs).catch(() => {}).finally(() => setLoading(false))
  }, [accountId])

  useEffect(() => {
    if (!accountId) return
    setTab('overview')
    setStats(null)
    setInsights(null)
    setOverdue(null)
    load(true)
  }, [accountId, load])

  if (!accountId) {
    return (
      <div className="empty card">
        Customer not found.{' '}
        <button type="button" className="text-link" onClick={() => navigate('/customers')}>
          Back to customers
        </button>
      </div>
    )
  }

  return (
    <div className="detail-page">
      <header className="cp-header">
        <button type="button" className="detail-back" onClick={() => navigate(-1)}>← Back</button>
        <div className="cp-title-wrap">
          <h1 className="cp-title">{stats?.name ?? (loading ? 'Loading…' : accountId)}</h1>
          {stats?.closed && <Badge tone="slate">Closed</Badge>}
          {stats?.has_portal_access && <Badge tone="indigo">Portal</Badge>}
        </div>
        <div className="cp-sub">
          <span>#{accountId}</span>
          {stats?.branch && <span>· {stats.branch}</span>}
          {stats?.is_importer && <Badge tone="emerald">Importer</Badge>}
          {stats?.is_exporter && <Badge tone="violet">Exporter</Badge>}
          <span>· {stats?.contact_count ?? 0} contacts</span>
          <span>· Last activity {fmt.date(stats?.last_activity)}</span>
        </div>

        {overdue && (
          <OverdueBadge
            size="md"
            count={overdue.overdue_count}
            amount={overdue.overdue_amount}
            currency={overdue.currency}
            oldestDue={overdue.oldest_due}
            onClick={() => setTab('invoices')}
          />
        )}

        <div className="cp-kpi-grid">
          <KpiCard label="Total shipments" value={fmt.int(stats?.total_shipments)} />
          <KpiCard label="In transit" value={fmt.int(stats?.in_transit)} />
          <KpiCard label="This month" value={fmt.int(stats?.this_month)} />
          <KpiCard label="Imports / Exports" value={`${fmt.int(stats?.imports)} / ${fmt.int(stats?.exports)}`} />
        </div>

        <div className="cp-tabs">
          <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabBtn>
          <TabBtn active={tab === 'shipments'} onClick={() => setTab('shipments')}>
            Shipments {stats ? <span className="cp-tab-n">{fmt.int(stats.total_shipments)}</span> : null}
          </TabBtn>
          <TabBtn active={tab === 'info'} onClick={() => setTab('info')}>Info</TabBtn>
          <TabBtn active={tab === 'invoices'} onClick={() => setTab('invoices')}>Invoices</TabBtn>
        </div>
      </header>

      <div className="cp-body">
        {tab === 'overview' && <CustomerOverviewTab insights={insights} />}
        {tab === 'shipments' && <CustomerShipmentsTab accountId={accountId} />}
        {tab === 'info' && (
          <CustomerInfoTab accountId={accountId} stats={stats} onReload={() => load(false)} />
        )}
        {tab === 'invoices' && (
          <section className="cp-card">
            <div className="cp-card-head">
              <h3 className="cp-card-title">Invoices</h3>
            </div>
            <InvoicesTable
              invoices={invoices}
              loading={invoicesLoading}
              showShipment
              paginate
              pageSize={25}
              outstandingByCurrency={outstandingByCurrency}
              emptyMessage="No invoices for this customer."
            />
          </section>
        )}
      </div>
    </div>
  )
}

function Badge({ children, tone }: { children: ReactNode; tone: 'slate' | 'indigo' | 'emerald' | 'violet' }) {
  return <span className={`cp-badge cp-badge--${tone}`}>{children}</span>
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`cp-tab ${active ? 'cp-tab--active' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}
