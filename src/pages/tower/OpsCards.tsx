import type React from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { C } from "./towerTheme";
import { Widget, Skeleton, Empty, Axis, niceMax, CountUp } from "./towerUi";
import { useTowerRpc, type ArrivalDay, type TmsToday, type QuoteFunnel, type Range } from "./useTower";

const ARR = [
  { k: "fcl" as const, t: "Sea FCL", c: C.navy },
  { k: "lcl" as const, t: "Sea LCL", c: C.blue2 },
  { k: "air" as const, t: "Air", c: C.orange },
];

export function ArrivalsCard({ style }: { style?: React.CSSProperties }) {
  const nav = useNavigate();
  const { data, loading } = useTowerRpc<ArrivalDay[]>("tower_arrivals", null, ["shipments"], 300_000);
  const days = data ?? [];
  const week = days.reduce((s, d) => s + d.fcl + d.lcl + d.air, 0);
  const W = 420, H = 190, pl = 26, pb = 22, pt = 10;
  const peak = Math.max(0, ...days.flatMap((d) => [d.fcl, d.lcl, d.air]));
  const step = peak > 40 ? 20 : peak > 16 ? 10 : 4, max = niceMax(peak, step);
  const cw = (W - pl) / 7, bw = cw * 0.2;

  return (
    <Widget title="Arrivals, next 7 days" count={week} link="Import board" onLink={() => nav("/bookings/import-sea")} style={style}>
      <div className="tw-wb">
        {loading && !data ? <Skeleton h={190} /> : week === 0 ? <Empty title="No arrivals due this week" /> : (
          <svg className="tw-chart" viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Import arrivals by day">
            <Axis W={W} H={H} pl={pl} pb={pb} pt={pt} max={max} step={step} />
            {days.map((d, i) => {
              const x0 = pl + i * cw + cw * 0.2;
              return (
                <g key={d.d}>
                  {ARR.map((s, k) => {
                    const v = d[s.k], h = (v / max) * (H - pb - pt);
                    return v ? (
                      <rect key={s.k} className="tw-grow" x={x0 + k * (bw + 2)} y={H - pb - h} width={bw} height={h} rx={2} fill={s.c} style={{ animationDelay: `${i * 50}ms` }}>
                        <title>{`${i ? d.dow : "Today"} ${s.t}: ${v}`}</title>
                      </rect>
                    ) : null;
                  })}
                  <text x={pl + i * cw + cw / 2} y={H - 6} textAnchor="middle" style={i ? undefined : { fill: C.ink }}>{i ? d.dow : "Today"}</text>
                </g>
              );
            })}
          </svg>
        )}
        <div className="tw-leg">{ARR.map((s) => <span key={s.k}><i style={{ background: s.c }} />{s.t}</span>)}</div>
      </div>
    </Widget>
  );
}

const TMS = [
  { k: "delivered" as const, t: "Delivered today", c: C.green },
  { k: "on_road" as const, t: "On road", c: C.blue },
  { k: "unassigned" as const, t: "Unassigned", c: C.amber },
  { k: "failed" as const, t: "Failed", c: C.red },
];

export function CartageCard({ style }: { style?: React.CSSProperties }) {
  const nav = useNavigate();
  const { data, loading } = useTowerRpc<TmsToday>("tower_tms", null, ["tms"], 60_000);
  const total = data ? TMS.reduce((s, x) => s + (data[x.k] || 0), 0) : 0;

  return (
    <Widget title="Cartage today" count={total} link="Dispatch" onLink={() => nav("/tms")} style={style}>
      <div className="tw-wb">
        {loading && !data ? <Skeleton h={170} /> : (
          <>
            <div className="tw-sbar" style={{ marginBottom: 12 }}>
              {total > 0 && TMS.filter((s) => data![s.k]).map((s, i) => (
                <i key={s.k} className="tw-growx" style={{ width: `${(data![s.k] / total) * 100}%`, background: s.c, animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
            {TMS.map((s) => (
              <div key={s.k} className="tw-rowx">
                <span><i className="tw-dot" style={{ background: s.c }} />{s.t}</span>
                <CountUp value={data?.[s.k] ?? 0} style={{ color: C.ink }} />
              </div>
            ))}
            {data && data.trucks_total > 0 && data.trucks_live < data.trucks_total && (
              <div className="tw-note"><AlertTriangle size={15} />{data.trucks_live} of {data.trucks_total} trucks reporting GPS</div>
            )}
          </>
        )}
      </div>
    </Widget>
  );
}

const PERIOD: Record<Range, string> = { week: "Last 7 days", month: "Last 30 days", year: "Last 12 months" };

export function QuotesCard({ range, style }: { range: Range; style?: React.CSSProperties }) {
  const nav = useNavigate();
  const { data, loading } = useTowerRpc<QuoteFunnel>("tower_quotes", { p_range: range }, ["quotes"], 120_000);
  const steps = data ? ([["Requested", data.requested], ["Priced", data.priced], ["Sent", data.sent], ["Won", data.won]] as const) : [];
  const top = Math.max(1, data?.requested ?? 1);
  const win = data && data.requested ? Math.round((data.won / data.requested) * 100) : null;
  const reply = data?.avg_reply_h == null ? "—" : data.avg_reply_h < 1 ? "<1 h" : `${data.avg_reply_h} h`;

  return (
    <Widget title="Quote pipeline" count={PERIOD[range]} link="Quotes" onLink={() => nav("/quotes")} style={style}>
      <div className="tw-wb">
        {loading && !data ? <Skeleton h={150} /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {steps.map(([label, v], i) => (
              <div key={label} style={{ display: "grid", gridTemplateColumns: "78px 1fr 30px", gap: 10, alignItems: "center", fontSize: 12.5 }}>
                <span>{label}</span>
                <div style={{ height: 20, background: "var(--line-soft)", borderRadius: 6, overflow: "hidden" }}>
                  <i className="tw-growx" style={{ display: "block", height: "100%", borderRadius: 6, width: `${(v / top) * 100}%`, background: i === 3 ? C.green : C.navy, animationDelay: `${i * 70}ms` }} />
                </div>
                <CountUp value={v} style={{ textAlign: "right", color: C.ink }} />
              </div>
            ))}
          </div>
        )}
        <div className="tw-sum">
          <div>Win rate<span className="tw-num">{win == null ? "—" : `${win}%`}</span></div>
          <div>First price<span className="tw-num">{reply}</span></div>
        </div>
      </div>
    </Widget>
  );
}
