import type React from "react";
import { useNavigate } from "react-router-dom";
import { C, money, titleCase } from "./towerTheme";
import { Widget, Skeleton, Empty, CountUp } from "./towerUi";
import { useTowerRpc, type Receivables } from "./useTower";

const AGE = [
  { k: "current" as const, t: "Current", c: C.green },
  { k: "d30" as const, t: "1–30 days", c: C.blue },
  { k: "d60" as const, t: "31–60 days", c: C.amber },
  { k: "d60p" as const, t: "Over 60", c: C.red },
];
const daysSince = (d: string | null) => d ? Math.max(0, Math.round((Date.now() - new Date(d + "T00:00:00").getTime()) / 864e5)) : null;

export function ReceivablesCard({ style }: { style?: React.CSSProperties }) {
  const nav = useNavigate();
  const { data, loading } = useTowerRpc<Receivables>("tower_ar", null, ["ar"], 300_000);
  const a = data?.ageing;
  const total = a ? AGE.reduce((s, x) => s + a[x.k], 0) : 0;

  return (
    <Widget title="Accounts receivable" count={a ? money(total) : undefined} style={style}>
      {loading && !data ? <div className="tw-wb"><Skeleton h={240} /></div> : !a || total === 0 ? <div className="tw-wb"><Empty title="Nothing outstanding" /></div> : (
        <>
          <div className="tw-wb" style={{ paddingBottom: 6 }}>
            <div className="tw-sbar" style={{ height: 12 }}>
              {AGE.filter((x) => a[x.k] > 0).map((x, i) => (
                <i key={x.k} className="tw-growx" title={`${x.t}: ${money(a[x.k])}`} style={{ width: `${(a[x.k] / total) * 100}%`, background: x.c, animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
            <div className="tw-buckets">
              {AGE.map((x) => (
                <div key={x.k}>
                  <span><i className="tw-dot" style={{ background: x.c, marginRight: 6 }} />{x.t}</span>
                  <CountUp className="v" value={a[x.k]} format={money} />
                </div>
              ))}
            </div>
          </div>
          <div className="tw-tw">
            <table className="tw-t">
              <thead><tr><th>Top overdue accounts</th><th className="r">Overdue</th><th className="r">Over 60 days</th><th className="r">Total owed</th><th className="r">Oldest</th></tr></thead>
              <tbody>
                {data!.debtors.map((d, i) => {
                  const days = daysSince(d.oldest_due);
                  const tone = days == null ? "grey" : days > 60 ? "red" : days > 30 ? "amber" : "grey";
                  return (
                    <tr key={d.account_id} style={{ animationDelay: `${i * 40}ms` }} onClick={() => nav(`/customers/${encodeURIComponent(d.account_id)}`)}>
                      <td className="name">{titleCase(d.name)}</td>
                      <td className="r tw-num" style={{ color: C.red }}>{money(d.overdue)}</td>
                      <td className={`r tw-num ${d.over60 ? "" : "m"}`}>{d.over60 ? money(d.over60) : "—"}</td>
                      <td className="r tw-num">{money(d.total)}</td>
                      <td className="r">{days == null ? "—" : <span className={`tw-pill tw-pill--${tone}`}>{days} d</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Widget>
  );
}
