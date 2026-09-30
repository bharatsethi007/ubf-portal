import { C, money, isDown } from "./towerTheme";
import { CountUp, Sparkline, Skeleton } from "./towerUi";
import { useTowerRpc, type Pulse, type Range } from "./useTower";

type Tile = { key: keyof Pulse; label: string; fmt: (n: number) => string };
const TILES: Tile[] = [
  { key: "jobs", label: "Jobs", fmt: (n) => Math.round(n).toLocaleString() },
  { key: "teu", label: "Sea TEU", fmt: (n) => Math.round(n).toLocaleString() },
  { key: "bookings", label: "Bookings received", fmt: (n) => Math.round(n).toLocaleString() },
  { key: "revenue", label: "Revenue", fmt: money },
  { key: "gp_margin", label: "GP margin, 90 days", fmt: (n) => n.toFixed(1) + "%" },
  { key: "ar_overdue", label: "Overdue receivables", fmt: money },
];
const VS: Record<Range, string> = { week: "vs last week", month: "vs last month", year: "vs prior year" };

function delta(key: keyof Pulse, p: Pulse, range: Range): { text: string; tail: string; bad: boolean } | null {
  const k = p[key];
  if (!k) return null;
  if (key === "gp_margin") {
    if (k.delta_pt == null) return null;
    const d = k.delta_pt;
    return { text: `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1)} pt`, tail: "vs prior 90 days", bad: d < 0 };
  }
  if (key === "ar_overdue") {
    if (!k.outstanding) return null;
    return { text: `${Math.round(((k.v || 0) / k.outstanding) * 100)}%`, tail: `of ${money(k.outstanding)} owed`, bad: true };
  }
  return k.delta ? { text: k.delta, tail: VS[range], bad: isDown(k.delta) } : null;
}

/* Server strips tiles the user cannot read, so we render whatever comes back. */
export function PulseStrip({ range }: { range: Range }) {
  const { data, loading } = useTowerRpc<Pulse>("tower_pulse", { p_range: range }, ["control_tower"], 120_000);
  const tiles = TILES.filter((t) => data?.[t.key]);

  if (loading && !data) {
    return (
      <div className="tw-kpis">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="tw-card tw-kpi"><Skeleton w={90} h={12} /><Skeleton w={110} h={28} /><Skeleton h={24} /></div>
        ))}
      </div>
    );
  }
  if (!tiles.length) return null;

  return (
    <div className="tw-kpis">
      {tiles.map((t, i) => {
        const k = data![t.key]!, d = delta(t.key, data!, range);
        return (
          <div key={t.key} className="tw-card tw-kpi" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="tw-kpi__l">{t.label}</div>
            <CountUp className="tw-kpi__v" value={k.v} format={t.fmt} />
            <div className="tw-kpi__s">
              {d ? <><span className={/^[+−-]?0(\.0)?%?$/.test(d.text) ? "" : d.bad ? "tw-dn" : "tw-up"}>{d.text}</span> {d.tail}</> : " "}
            </div>
            <Sparkline data={k.series} color={d?.bad ? C.red : C.navy} />
          </div>
        );
      })}
    </div>
  );
}
