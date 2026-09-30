import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { C, titleCase } from "./towerTheme";
import { Widget, Skeleton, Empty, Axis, niceMax, CountUp } from "./towerUi";
import { useTowerRpc, type Range, type VolumePoint, type TopCustomer, type Csat } from "./useTower";

const SPLITS = [
  [{ k: "sea" as const, t: "Sea", c: C.navy }, { k: "air" as const, t: "Air", c: C.blue2 }],
  [{ k: "imp" as const, t: "Import", c: C.orange }, { k: "exp" as const, t: "Export", c: C.navy }],
];

/* One stacked chart replaces the old Air vs Sea and Import vs Export line charts. */
export function VolumeCard({ range, style }: { range: Range; style?: React.CSSProperties }) {
  const nav = useNavigate();
  const [tab, setTab] = useState(0);
  const { data, loading } = useTowerRpc<VolumePoint[]>("tower_volume", { p_range: range }, ["shipments"]);
  const pts = data ?? [], s = SPLITS[tab];
  const W = 640, H = 220, pl = 34, pb = 22, pt = 10;
  const peak = Math.max(0, ...pts.map((p) => s.reduce((a, x) => a + p[x.k], 0)));
  const step = peak > 400 ? 100 : peak > 100 ? 50 : 10, max = niceMax(peak, step);
  const cw = (W - pl) / Math.max(1, pts.length), bw = cw * 0.5;
  const last = pts[pts.length - 1];

  return (
    <Widget title="Job volume" link="Reports" onLink={() => nav("/reports")} style={style}
      tabs={{ items: ["Sea and air", "Import and export"], value: tab, onChange: setTab }}>
      <div className="tw-wb">
        {loading && !data ? <Skeleton h={220} /> : !pts.length ? <Empty title="No jobs in range" /> : (
          <svg key={tab + range} className="tw-chart" viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Jobs per period">
            <Axis W={W} H={H} pl={pl} pb={pb} pt={pt} max={max} step={step} />
            {pts.map((p, i) => {
              let acc = 0;
              const x = pl + i * cw + (cw - bw) / 2, isLast = i === pts.length - 1;
              return (
                <g key={p.x}>
                  <title>{`${p.x}: ${s.map((z) => `${z.t} ${p[z.k]}`).join(", ")}`}</title>
                  {s.map((z, j) => {
                    const v = p[z.k], h = (v / max) * (H - pb - pt), y = H - pb - ((acc + v) / max) * (H - pb - pt);
                    acc += v;
                    return <rect key={z.k} className="tw-grow" x={x} y={y} width={bw} height={Math.max(0, h)} rx={j ? 3 : 0} fill={z.c} style={{ animationDelay: `${i * 40}ms` }} />;
                  })}
                  <text x={x + bw / 2} y={H - 6} textAnchor="middle" style={isLast ? { fill: C.ink } : undefined}>{p.x}</text>
                </g>
              );
            })}
          </svg>
        )}
        <div className="tw-leg">{s.map((z) => <span key={z.k}><i style={{ background: z.c }} />{z.t}{last ? ` · latest ${last[z.k]}` : ""}</span>)}</div>
      </div>
    </Widget>
  );
}

export function TopCustomersCard({ range, style }: { range: Range; style?: React.CSSProperties }) {
  const nav = useNavigate();
  const { data, loading } = useTowerRpc<TopCustomer[]>("tower_customers", { p_range: range }, ["customers"]);
  const rows = data ?? [];

  return (
    <Widget title="Top customers" count={range === "week" ? "This week" : range === "month" ? "This month" : "This year"} link="Customers" onLink={() => nav("/customers")} style={style}>
      {loading && !data ? <div className="tw-wb"><Skeleton h={220} /></div> : !rows.length ? <div className="tw-wb"><Empty title="No jobs in range" /></div> : (
        <div className="tw-wb tw-wb--flush tw-tw">
          <table className="tw-t">
            <thead><tr><th>Customer</th><th className="r">Jobs</th><th className="r">Usual</th><th className="r">Change</th></tr></thead>
            <tbody>
              {rows.map((c, i) => {
                const ch = c.base > 0 ? Math.round(((c.n - c.base) / c.base) * 100) : null;
                const tone = ch == null ? "blue" : ch > 5 ? "green" : ch < -5 ? "red" : "grey";
                return (
                  <tr key={c.account_id} style={{ animationDelay: `${i * 40}ms` }} onClick={() => nav(`/customers/${encodeURIComponent(c.account_id)}`)}>
                    <td className="name">{titleCase(c.name)}</td>
                    <td className="r ink tw-num">{c.n}</td>
                    <td className="r m tw-num">{c.base.toFixed(1)}</td>
                    <td className="r"><span className={`tw-pill tw-pill--${tone}`}>{ch == null ? "New" : `${ch > 0 ? "+" : ch < 0 ? "−" : ""}${Math.abs(ch)}%`}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: "10px 18px", fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--line-soft)" }}>Usual = average of the previous four periods.</div>
        </div>
      )}
    </Widget>
  );
}

const CH: Record<string, string> = { email: "Email", whatsapp: "WhatsApp", portal: "Portal", sms: "SMS" };

export function CsatCard({ style }: { style?: React.CSSProperties }) {
  const { data, loading } = useTowerRpc<Csat>("tower_csat", null, ["customers"], 300_000);
  const chans = Object.entries(data?.channels ?? {});
  const n = chans.reduce((s, [, v]) => s + v, 0);
  const trend = data?.avg != null && data?.prev != null ? data.avg - data.prev : null;

  return (
    <Widget title="Customer satisfaction" count="Last 30 days" style={style}>
      <div className="tw-wb">
        {loading && !data ? <Skeleton h={150} /> : data?.avg == null ? (
          <Empty title="No survey responses in 30 days" icon={<MessageSquare size={26} color={C.faint} />}>
            Surveys go out from completed bookings by email or WhatsApp.
          </Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <CountUp value={data.avg} format={(v) => v.toFixed(1)} style={{ fontSize: 36, fontWeight: 600, color: C.ink }} />
              <span style={{ color: C.muted }}>out of 5 from {data.n} responses</span>
            </div>
            <div className="tw-sbar" style={{ height: 8 }}>
              <i className="tw-growx" style={{ width: `${(data.avg / 5) * 100}%`, background: data.avg >= 4 ? C.green : data.avg >= 3 ? C.amber : C.red }} />
            </div>
            {trend != null && <div style={{ fontSize: 12, color: C.muted }}><span className={trend < 0 ? "tw-dn" : "tw-up"}>{trend >= 0 ? "+" : "−"}{Math.abs(trend).toFixed(1)}</span> vs previous 30 days</div>}
            {chans.map(([k, v]) => (
              <div key={k} className="tw-rowx"><span>{CH[k] ?? k}</span><span className="tw-num" style={{ color: C.ink }}>{Math.round((v / n) * 100)}%</span></div>
            ))}
          </div>
        )}
      </div>
    </Widget>
  );
}
