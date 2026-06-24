// CustomerProfilePanel.tsx — wide right-side drawer replacing the old narrow stats sidebar.
// Usage:
//   <CustomerProfilePanel accountId={selected} open={!!selected} onClose={() => setSelected(null)} />
import React, { useCallback, useEffect, useState } from 'react';
import './customerProfile.css';
import {
  fetchCustomerStats, fetchCustomerInsights,
  type CustomerStats, type Insights,
} from './customerProfileApi';
import { KpiCard, fmt } from './profileUi';
import { CustomerOverviewTab } from './CustomerOverviewTab';
import { CustomerShipmentsTab } from './CustomerShipmentsTab';
import { CustomerInfoTab } from './CustomerInfoTab';

type Tab = 'overview' | 'shipments' | 'info';

export function CustomerProfilePanel({
  accountId, open, onClose,
}: { accountId: string | null; open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback((withInsights: boolean) => {
    if (!accountId) return;
    setLoading(true);
    const jobs: Promise<unknown>[] = [fetchCustomerStats(accountId).then(setStats)];
    if (withInsights) jobs.push(fetchCustomerInsights(accountId).then(setInsights));
    Promise.all(jobs).catch(() => {}).finally(() => setLoading(false));
  }, [accountId]);

  useEffect(() => {
    if (!open || !accountId) return;
    setTab('overview');
    setStats(null);
    setInsights(null);
    load(true);
  }, [open, accountId, load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open || !accountId) return null;

  return (
    <div className="cp-overlay">
      <div className="cp-scrim" onClick={onClose} />
      <div className="cp-drawer">
        <div className="cp-header">
          <div className="cp-title-row">
            <div>
              <div className="cp-title-wrap">
                <h2 className="cp-title">{stats?.name ?? (loading ? 'Loading…' : accountId)}</h2>
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
            </div>
            <button className="cp-close" onClick={onClose}>✕</button>
          </div>

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
          </div>
        </div>

        <div className="cp-body">
          {tab === 'overview' && <CustomerOverviewTab insights={insights} />}
          {tab === 'shipments' && <CustomerShipmentsTab accountId={accountId} />}
          {tab === 'info' && <CustomerInfoTab accountId={accountId} stats={stats} onReload={() => load(false)} />}
        </div>
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'slate' | 'indigo' | 'emerald' | 'violet' }) {
  return <span className={`cp-badge cp-badge--${tone}`}>{children}</span>;
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`cp-tab ${active ? 'cp-tab--active' : ''}`} onClick={onClick}>{children}</button>
  );
}
