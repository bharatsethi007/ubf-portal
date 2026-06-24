// CustomerOverviewTab.tsx
import React from 'react';
import type { Insights } from './customerProfileApi';
import { Card, MiniBars, SplitBar, Lane, fmt } from './profileUi';

const MODE_COLORS: Record<string, string> = { air: 'cp-c-sky', sea: 'cp-c-indigo' };
const DIR_COLORS: Record<string, string> = { import: 'cp-c-emerald', export: 'cp-c-violet' };

export function CustomerOverviewTab({ insights }: { insights: Insights | null }) {
  if (!insights) {
    return (
      <div className="cp-skel-grid">
        {[0, 1, 2, 3].map((i) => <div key={i} className="cp-skel cp-skel-card" />)}
      </div>
    );
  }

  const modeSegs = insights.modes.map((m) => ({ label: m.mode, value: m.count, color: MODE_COLORS[m.mode] ?? 'cp-c-slate' }));
  const dirSegs = insights.direction.map((d) => ({ label: d.direction, value: d.count, color: DIR_COLORS[d.direction] ?? 'cp-c-slate' }));
  const statusMax = Math.max(1, ...insights.status.map((s) => s.count));
  const perf = insights.performance;

  return (
    <div className="cp-grid">
      <Card title="Shipment volume — last 12 months">
        {insights.monthly.length ? <MiniBars data={insights.monthly} valueKey="count" /> : <Empty />}
      </Card>

      <Card title="Volume (m³) by month">
        {insights.monthly.length ? <MiniBars data={insights.monthly} valueKey="volume_m3" color="cp-bar--teal" /> : <Empty />}
      </Card>

      <Card title="Mode & direction split">
        <div className="cp-split-group">
          <div>
            <div className="cp-split-sublabel">Mode</div>
            {modeSegs.length ? <SplitBar segments={modeSegs} /> : <Empty />}
          </div>
          <div>
            <div className="cp-split-sublabel">Direction</div>
            {dirSegs.length ? <SplitBar segments={dirSegs} /> : <Empty />}
          </div>
        </div>
      </Card>

      <Card title="Status breakdown">
        {insights.status.length ? insights.status.map((s) => (
          <div key={s.status} className="cp-statusrow">
            <div className="cp-status-label">{s.status}</div>
            <div className="cp-status-track">
              <div className="cp-status-fill" style={{ width: `${(s.count / statusMax) * 100}%` }} />
            </div>
            <div className="cp-status-n">{s.count}</div>
          </div>
        )) : <Empty />}
      </Card>

      <Card title="Top trade lanes">
        {insights.lanes.length ? insights.lanes.map((l, i) => (
          <div key={i} className="cp-lane-row">
            <Lane origin={l.origin} destination={l.destination} />
            <span className="cp-lane-n">{l.count}</span>
          </div>
        )) : <Empty />}
      </Card>

      <Card title="Performance & throughput">
        <div className="cp-metrics">
          <Metric label="On-time" value={perf.on_time_pct == null ? '—' : `${perf.on_time_pct}%`} />
          <Metric label="Avg delay" value={perf.avg_delay_days == null ? '—' : `${perf.avg_delay_days} d`} />
          <Metric label="Avg transit" value={perf.avg_transit_days == null ? '—' : `${perf.avg_transit_days} d`} />
          <Metric label="Total volume" value={`${fmt.num(insights.totals.volume_m3)} m³`} />
        </div>
        {perf.measured === 0 && (
          <p className="cp-note">On-time metrics need actual departed/arrived dates — sparse in current sync.</p>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="cp-metric">
      <div className="cp-metric-label">{label}</div>
      <div className="cp-metric-value">{value}</div>
    </div>
  );
}

function Empty() { return <div className="cp-empty">No data</div>; }
