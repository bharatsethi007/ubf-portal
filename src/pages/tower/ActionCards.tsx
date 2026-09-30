import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Widget, Skeleton, Empty } from "./towerUi";
import { titleCase } from "./towerTheme";
import { useTowerRpc, type ActionItem, type ExceptionItem } from "./useTower";

const ACTION_HREF: Record<string, string> = {
  portal: "/bookings/IS", email: "/bookings/IS", nojob: "/bookings/IS",
  topricing: "/quotes", expiring: "/quotes", raterq: "/quotes",
};
const age = (h: number | null) => h == null ? "—" : h < 1 ? "Under 1 h" : h < 48 ? `${h} h` : `${Math.round(h / 24)} days`;

export function ActionQueue({ style }: { style?: React.CSSProperties }) {
  const nav = useNavigate();
  const { data, loading } = useTowerRpc<ActionItem[]>("tower_actions", null, ["bookings", "quotes", "rates"], 60_000);
  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + r.n, 0);

  return (
    <Widget title="Action required" count={total} hot={total > 0} style={style}>
      {loading && !data ? <div className="tw-wb"><Skeleton h={200} /></div> : (
        <div className="tw-wb tw-wb--flush tw-tw">
          <table className="tw-t">
            <thead><tr><th>Queue</th><th className="r">Open</th><th className="r">Oldest</th></tr></thead>
            <tbody>
              {rows.map((a, i) => {
                const late = a.n > 0 && (a.oldest_h ?? 0) >= 48;
                return (
                  <tr key={a.key} style={{ animationDelay: `${i * 40}ms` }} onClick={() => nav(ACTION_HREF[a.key] ?? a.href)}>
                    <td className="name">{a.label}</td>
                    <td className="r"><span className={`tw-badge tw-num ${a.n ? "tw-badge--on" : "tw-badge--off"}`}>{a.n}</span></td>
                    <td className={`r ${late ? "" : "m"}`} style={late ? { color: "var(--red)" } : undefined}>{a.n ? age(a.oldest_h) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Widget>
  );
}

const KINDS: { label: string; kinds: string[] }[] = [
  { label: "All", kinds: [] },
  { label: "Last free day", kinds: ["lfd", "atport"] },
  { label: "Holds", kinds: ["hold"] },
  { label: "Late vessel", kinds: ["overdue"] },
  { label: "Cartage", kinds: ["tms"] },
];

export function ExceptionsCard({ style }: { style?: React.CSSProperties }) {
  const nav = useNavigate();
  const [tab, setTab] = useState(0);
  const { data, loading } = useTowerRpc<ExceptionItem[]>("tower_exceptions", null, ["bookings", "tms"], 60_000);
  const all = data ?? [];
  const count = (k: string[]) => (k.length ? all.filter((e) => k.includes(e.kind)).length : all.length);
  const rows = (KINDS[tab].kinds.length ? all.filter((e) => KINDS[tab].kinds.includes(e.kind)) : all).slice(0, 8);
  const critical = all.filter((e) => e.sev === "bad").length;

  return (
    <Widget title="Exceptions" count={all.length} hot={critical > 0} style={style}
      tabs={{ items: KINDS.map((k) => `${k.label} ${count(k.kinds)}`), value: tab, onChange: setTab }}>
      {loading && !data ? <div className="tw-wb"><Skeleton h={160} /></div> : rows.length === 0 ? (
        <div className="tw-wb"><Empty title="Nothing flagged">No shipments need attention in this category.</Empty></div>
      ) : (
        <div className="tw-wb tw-wb--flush tw-tw">
          <table className="tw-t">
            <thead><tr><th>Severity</th><th>Reference</th><th>Party</th><th>Issue</th><th className="r">Status</th></tr></thead>
            <tbody>
              {rows.map((e, i) => {
                const [ref, party] = e.title.split(" · ");
                return (
                  <tr key={i} style={{ animationDelay: `${i * 40}ms` }} onClick={() => nav(e.kind === "tms" ? "/tms" : "/bookings/import-sea")}>
                    <td><span className={`tw-pill ${e.sev === "bad" ? "tw-pill--red" : "tw-pill--amber"}`}>{e.sev === "bad" ? "Critical" : "Warning"}</span></td>
                    <td className="ink tw-num">{ref}</td>
                    <td className="name">{titleCase(party)}</td>
                    <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>{e.sub}</td>
                    <td className="r m">{e.pill}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: "12px 18px", fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--line-soft)" }}>
            Checks last free day, customs holds, vessels past ETA without discharge, and failed deliveries.
          </div>
        </div>
      )}
    </Widget>
  );
}
