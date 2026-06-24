// CustomerShipmentsTab.tsx
import React, { useEffect, useState } from 'react';
import { fetchCustomerShipments, type ShipmentRow, type ShipmentFilters } from './customerProfileApi';
import { StatusPill, ModeIcon, Lane, fmt } from './profileUi';

const PAGE_SIZE = 25;
const MODULES = ['FEA', 'FES', 'FIA', 'FIS'];
const STATUSES = ['Arrived', 'Arrived (est.)', 'In transit', 'Booked', 'Scheduled'];

export function CustomerShipmentsTab({ accountId }: { accountId: string }) {
  const [filters, setFilters] = useState<ShipmentFilters>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ShipmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: search || undefined }));
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCustomerShipments(accountId, page, PAGE_SIZE, filters)
      .then((res) => { if (alive) { setRows(res.rows); setTotal(res.total); } })
      .catch(() => { if (alive) { setRows([]); setTotal(0); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [accountId, page, filters]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const set = (k: keyof ShipmentFilters, v: string) => {
    setFilters((f) => ({ ...f, [k]: v || undefined }));
    setPage(0);
  };

  return (
    <div>
      <div className="cp-toolbar">
        <input className="cp-input" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search bill, port, vessel, goods…" />
        <Select value={filters.module ?? ''} onChange={(v) => set('module', v)} placeholder="Module" options={MODULES} />
        <Select value={filters.mode ?? ''} onChange={(v) => set('mode', v)} placeholder="Mode" options={['air', 'sea']} />
        <Select value={filters.direction ?? ''} onChange={(v) => set('direction', v)} placeholder="Direction" options={['import', 'export']} />
        <Select value={filters.status ?? ''} onChange={(v) => set('status', v)} placeholder="Status" options={STATUSES} />
        <div className="cp-count">{fmt.int(total)} shipments</div>
      </div>

      <div className="cp-table-wrap">
        <table className="cp-table">
          <thead>
            <tr>
              <th>Status</th><th className="cp-c">Mode</th><th>Lane</th><th>House / Master</th>
              <th>Vessel / Flight</th><th>ETD</th><th>ETA</th><th className="cp-r">Wt (kg)</th><th className="cp-r">Vol (m³)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}><td colSpan={9}><div className="cp-skel-line" /></td></tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="cp-table-empty">No shipments match these filters.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.job_unique}>
                <td><StatusPill status={r.status} /></td>
                <td className="cp-c"><ModeIcon mode={r.mode} /></td>
                <td><Lane origin={r.origin} destination={r.destination} /></td>
                <td>
                  <div className="cp-cell-strong">{r.house_bill ?? '—'}</div>
                  <div className="cp-cell-sub">{r.master_bill ?? ''}</div>
                </td>
                <td>{r.vessel_flight ?? '—'}</td>
                <td>{fmt.date(r.etd)}</td>
                <td>{fmt.date(r.eta)}</td>
                <td className="cp-r cp-num">{fmt.int(r.weight_kg)}</td>
                <td className="cp-r cp-num">{fmt.num(r.volume_m3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cp-pager">
        <span className="cp-pager-info">Page {page + 1} of {pages}</span>
        <div className="cp-pager-btns">
          <button className="cp-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <button className="cp-btn" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

function Select({ value, onChange, placeholder, options }:
  { value: string; onChange: (v: string) => void; placeholder: string; options: string[] }) {
  return (
    <select className="cp-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
