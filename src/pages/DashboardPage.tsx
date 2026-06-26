import React, { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Ship, Plane, ArrowRight, Inbox, ChevronDown, Plus, Download, FileSignature, ClipboardList,
} from "lucide-react";
import {
  useDashboard, useTopLanes, useTopCustomers, useMapPoints,
  type Range, type Dir, type Mode,
} from "./useDashboard";
import { ShipmentMap } from "./ShipmentMap";

/* ══════ UB FREIGHT · CONTROL TOWER — content only (no shell) ══════ */
const NAVY = "#0A2472", ORANGE = "#F7941D";
const C = {
  ink: "#1A1E24", ink2: "#5B6470", mut: "#9499A2", faint: "#CBD0D7",
  border: "#E8EAEF", line: "#EFF1F4", chip: "#F4F5F7", green: "#1FA463",
  navySoft: "#EAEDF6", orangeSoft: "#FEF2E3", red: "#E03257",
};
const FONT = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.7)", backdropFilter: "blur(16px) saturate(150%)",
  WebkitBackdropFilter: "blur(16px) saturate(150%)", border: "1px solid rgba(255,255,255,0.75)",
  boxShadow: "0 1px 2px rgba(16,19,23,.04), 0 10px 30px rgba(16,19,23,.05), inset 0 1px 0 rgba(255,255,255,.6)",
  borderRadius: 16,
};
const money = (n: number) => n >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? "$" + Math.round(n / 1e3) + "k" : "$" + Math.round(n || 0);
const deltaColor = (d?: string) => (d && d.startsWith("−") ? C.red : C.green);
const MODULE_LABEL: Record<string, string> = { FIA: "Import Air", FIS: "Import Sea", FEA: "Export Air", FES: "Export Sea" };

const Card = ({ children, style, pad = 18 }: any) => <div style={{ ...glass, padding: pad, ...style }}>{children}</div>;
const Title = ({ children, right }: any) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
    <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{children}</span>{right}
  </div>
);
const LegendDot = ({ c, t }: any) => <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.ink2 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: c }} />{t}</span>;
function Seg<T extends string>({ options, value, onChange, color = NAVY }: { options: { k: T; label: string; icon?: any; color?: string }[]; value: T; onChange: (k: T) => void; color?: string }) {
  return (
    <div style={{ display: "inline-flex", background: C.chip, borderRadius: 9, padding: 3 }}>
      {options.map((o) => {
        const on = o.k === value;
        return (
          <button key={o.k} onClick={() => onChange(o.k)} style={{
            border: "none", cursor: "pointer", padding: "5px 11px", borderRadius: 7, fontSize: 12,
            fontWeight: on ? 600 : 500, background: on ? "#fff" : "transparent",
            color: on ? (o.color || color) : C.mut, boxShadow: on ? "0 1px 2px rgba(16,19,23,.08)" : "none",
            display: "inline-flex", alignItems: "center", gap: 5,
          }}>{o.icon}{o.label}</button>
        );
      })}
    </div>
  );
}
const Lane = ({ o, d }: { o: string; d: string }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{o} <ArrowRight size={11} color={C.mut} /> {d}</span>
);
const Empty = ({ children }: any) => <div style={{ padding: "28px 0", textAlign: "center", fontSize: 12.5, color: C.mut }}>{children}</div>;

/* ── trend ── */
function TrendCard({ title, data, s1, s2, c1, c2, range }: any) {
  return (
    <Card>
      <Title right={<div style={{ display: "flex", gap: 14 }}><LegendDot c={c1} t={s1} /><LegendDot c={c2} t={s2} /></div>}>{title}</Title>
      <ResponsiveContainer width="100%" height={196}>
        <LineChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={C.line} vertical={false} />
          <XAxis dataKey="x" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} dy={6} interval={range === "year" ? 1 : 0} />
          <YAxis tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} />
          <Tooltip content={<TrendTip />} cursor={{ stroke: C.border }} />
          <Line type="monotone" dataKey={s1} stroke={c1} strokeWidth={2.2} dot={false} activeDot={{ r: 4, fill: "#fff", strokeWidth: 2 }} />
          <Line type="monotone" dataKey={s2} stroke={c2} strokeWidth={2.2} dot={false} activeDot={{ r: 4, fill: "#fff", strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
const TrendTip = ({ active, payload, label }: any) => !active || !payload?.length ? null : (
  <div style={{ ...glass, background: "rgba(255,255,255,.92)", padding: "10px 12px", borderRadius: 11 }}>
    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 7 }}>{label}</div>
    {payload.map((p: any, i: number) => (
      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: i ? 5 : 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: p.stroke }} />
        <span style={{ color: C.ink2 }}>{p.name}</span>
        <span style={{ marginLeft: "auto", fontWeight: 600 }}>{p.value}</span>
      </div>
    ))}
  </div>
);

/* ── new bookings ── */
function NewBookings({ rows }: { rows: any[] }) {
  return (
    <Card pad={0}>
      <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "center", gap: 9 }}>
        <Inbox size={16} color={NAVY} />
        <div><div style={{ fontSize: 14, fontWeight: 600 }}>New Bookings</div><div style={{ fontSize: 11, color: C.mut }}>From Customer Portal</div></div>
        <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: NAVY, background: C.navySoft, padding: "3px 9px", borderRadius: 99 }}>{rows.length} new</span>
      </div>
      <div style={{ borderTop: `1px solid ${C.line}` }}>
        {rows.length === 0 && <Empty>No new bookings</Empty>}
        {rows.map((b, i) => {
          const label = MODULE_LABEL[b.module] || b.module || "Booking";
          const imp = label.startsWith("Import"), col = imp ? ORANGE : NAVY, soft = imp ? C.orangeSoft : C.navySoft;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 18px", borderBottom: i < rows.length - 1 ? `1px solid ${C.line}` : "none", cursor: "pointer" }}>
              {label.includes("Air") ? <Plane size={15} color={col} /> : <Ship size={15} color={col} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.customer || b.ref}</div>
                <div style={{ fontSize: 11, color: C.mut, marginTop: 2 }}><Lane o={b.onm} d={b.dnm} /></div>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 500, color: col, background: soft, padding: "3px 8px", borderRadius: 6 }}>{label}</span>
            </div>
          );
        })}
      </div>
      <button style={{ margin: "12px 18px 16px", padding: "9px", borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,.5)", fontSize: 12.5, fontWeight: 500, color: NAVY, cursor: "pointer", width: "calc(100% - 36px)" }}>Review all bookings</button>
    </Card>
  );
}

/* ── trade lanes ── */
function TradeLanes({ range }: { range: Range }) {
  const [dir, setDir] = useState<Dir>("import");
  const [mode, setMode] = useState<Mode>("sea");
  const { data, loading } = useTopLanes(range, dir, mode);
  const max = data[0]?.n || 1;
  const accent = dir === "import" ? ORANGE : NAVY;
  return (
    <Card pad={0}>
      <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Top 10 Trade Lanes</span>
        <div style={{ display: "flex", gap: 8 }}>
          <Seg value={dir} onChange={setDir} options={[{ k: "import" as Dir, label: "Import", color: ORANGE }, { k: "export" as Dir, label: "Export", color: NAVY }]} />
          <Seg value={mode} onChange={setMode} options={[{ k: "sea" as Mode, label: "Sea", icon: <Ship size={12} /> }, { k: "air" as Mode, label: "Air", icon: <Plane size={12} /> }]} />
        </div>
      </div>
      <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 9, minHeight: 300 }}>
        {loading ? <Empty>Loading…</Empty> : data.length === 0 ? <Empty>No lanes in range</Empty> : data.map((l, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "16px 160px 1fr 52px", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: C.mut }}>{i + 1}</span>
            <span style={{ fontSize: 12.5, fontWeight: 500 }}><Lane o={l.onm} d={l.dnm} /></span>
            <div style={{ height: 8, background: C.chip, borderRadius: 99 }}><div style={{ width: `${(l.n / max) * 100}%`, height: "100%", borderRadius: 99, background: accent, opacity: 0.4 + 0.6 * (l.n / max) }} /></div>
            <span style={{ fontSize: 12.5, fontWeight: 600, textAlign: "right" }}>{l.n}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── customers ── */
function TopCustomers({ range }: { range: Range }) {
  const [mode, setMode] = useState<Mode>("sea");
  const { data, loading } = useTopCustomers(range, mode);
  const max = Math.max(1, ...data.map((r) => r.n));
  const accent = mode === "sea" ? NAVY : ORANGE;
  return (
    <Card pad={0}>
      <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Top 10 Customers</span>
        <Seg value={mode} onChange={setMode} options={[{ k: "sea" as Mode, label: "Sea", icon: <Ship size={12} /> }, { k: "air" as Mode, label: "Air", icon: <Plane size={12} /> }]} />
      </div>
      <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 11, minHeight: 300 }}>
        {loading ? <Empty>Loading…</Empty> : data.length === 0 ? <Empty>No customers in range</Empty> : data.map((r, i) => (
          <div key={r.account_id} style={{ display: "grid", gridTemplateColumns: "16px 1fr 90px", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: C.mut }}>{i + 1}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                <span style={{ fontSize: 11, color: C.mut, marginLeft: 8 }}><Lane o={r.onm} d={r.dnm} /></span>
              </div>
              <div style={{ height: 6, background: C.chip, borderRadius: 99 }}><div style={{ width: `${(r.n / max) * 100}%`, height: "100%", borderRadius: 99, background: accent }} /></div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.n}</div>
              <div style={{ fontSize: 10, color: C.mut }}>{money(r.revenue)}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── map ── */
function MapCard({ range }: { range: Range }) {
  const [dir, setDir] = useState<Dir>("import");
  const { data } = useMapPoints(range, dir);
  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <div style={{ padding: "16px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Shipments Map · Air &amp; Sea</div>
          <div style={{ fontSize: 11.5, color: C.mut, marginTop: 2 }}>{dir === "import" ? "Origin ports (inbound)" : "Destination ports (outbound)"}</div>
        </div>
        <Seg value={dir} onChange={setDir} options={[{ k: "import" as Dir, label: "Imports", color: ORANGE }, { k: "export" as Dir, label: "Exports", color: NAVY }]} />
      </div>
      <div style={{ padding: "0 14px 10px" }}><ShipmentMap points={data} dir={dir} height={300} /></div>
      <div style={{ padding: "0 18px 14px", display: "flex", gap: 18, fontSize: 11.5, color: C.ink2 }}>
        <LegendDot c={ORANGE} t="Imports" /><LegendDot c={NAVY} t="Exports" />
        <span style={{ marginLeft: "auto", color: C.mut }}>Bubble size = shipment count</span>
      </div>
    </Card>
  );
}

/* ── finance ── */
function FinanceCard({ finance, range }: { finance: any; range: Range }) {
  const f = finance || { revenue: 0, invoiced: 0, collected: 0, outstanding: 0, ageing: {} };
  const order = ["Current", "1-30", "31-60", "60+"];
  const colors: any = { Current: C.green, "1-30": NAVY, "31-60": ORANGE, "60+": C.red };
  const agMax = Math.max(1, ...order.map((k) => f.ageing?.[k] || 0));
  return (
    <Card>
      <Title>Finance &amp; Sales</Title>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.3fr 1.6fr", gap: 24 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{money(f.revenue)}</div>
          <div style={{ fontSize: 11.5, color: C.mut }}>revenue this {range}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "center", borderLeft: `1px solid ${C.line}`, borderRight: `1px solid ${C.line}`, padding: "0 22px" }}>
          <Stat label="Invoiced" value={money(f.invoiced)} />
          <Stat label="Collected" value={money(f.collected)} />
          <Stat label="Outstanding" value={money(f.outstanding)} warn />
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: C.mut, fontWeight: 600, letterSpacing: ".08em", marginBottom: 10 }}>AR AGEING</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {order.map((b) => {
              const v = f.ageing?.[b] || 0;
              return (
                <div key={b} style={{ display: "grid", gridTemplateColumns: "56px 1fr 52px", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11.5, color: C.ink2 }}>{b}</span>
                  <div style={{ height: 7, background: C.chip, borderRadius: 99 }}><div style={{ width: `${(v / agMax) * 100}%`, height: "100%", borderRadius: 99, background: colors[b] }} /></div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, textAlign: "right" }}>{money(v)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
const Stat = ({ label, value, warn }: any) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <span style={{ fontSize: 12, color: C.ink2 }}>{label}</span>
    <span style={{ fontSize: 14, fontWeight: 600, color: warn ? ORANGE : C.ink }}>{value}</span>
  </div>
);
const MenuItem = ({ icon: Icon, title, sub }: any) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, cursor: "pointer" }}
    onMouseEnter={(e) => (e.currentTarget.style.background = C.chip)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
    <div style={{ width: 30, height: 30, borderRadius: 8, background: C.navySoft, display: "grid", placeItems: "center" }}><Icon size={15} color={NAVY} /></div>
    <div><div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div><div style={{ fontSize: 10.5, color: C.mut }}>{sub}</div></div>
  </div>
);

/* ══════ PAGE (content only — renders inside the app shell) ══════ */
export default function DashboardPage() {
  const [range, setRange] = useState<Range>("week");
  const [newOpen, setNewOpen] = useState(false);
  const { kpis, trends, finance, newBookings } = useDashboard(range);

  const KPIS = [
    { label: "Bookings", k: kpis?.bookings },
    { label: "Active Trade Lanes", k: kpis?.lanes },
    { label: "Active Customers", k: kpis?.customers },
    { label: "Revenue", k: kpis?.revenue, money: true },
    { label: "Outstanding AR", k: kpis?.ar, money: true },
  ];
  const JOBS = [
    { code: "EA", label: "Export Air", k: kpis?.jobs?.EA, icon: Plane, accent: NAVY },
    { code: "ES", label: "Export Sea", k: kpis?.jobs?.ES, icon: Ship, accent: NAVY },
    { code: "IA", label: "Import Air", k: kpis?.jobs?.IA, icon: Plane, accent: ORANGE },
    { code: "IS", label: "Import Sea", k: kpis?.jobs?.IS, icon: Ship, accent: ORANGE },
  ];

  return (
    <div style={{ fontFamily: FONT, color: C.ink, position: "relative", padding: "4px 4px 28px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700;800&display=swap');`}</style>
      {/* subtle glass backdrop blobs */}
      <div style={{ position: "absolute", top: -40, right: -30, width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${NAVY}12, transparent 70%)`, filter: "blur(20px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 80, left: -60, width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle, ${ORANGE}10, transparent 70%)`, filter: "blur(20px)", pointerEvents: "none" }} />

      <div style={{ position: "relative" }}>
        {/* header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: "-.02em" }}>Hello, Bharat <span style={{ fontWeight: 300 }}>!</span></h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Seg value={range} onChange={setRange} options={[{ k: "week" as Range, label: "Week" }, { k: "month" as Range, label: "Month" }, { k: "year" as Range, label: "Year" }]} />
            <button style={{ display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${C.border}`, background: "rgba(255,255,255,.7)", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}><Download size={15} /> Export</button>
            <div style={{ position: "relative" }}>
              <button onClick={() => setNewOpen((o) => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: NAVY, color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                <Plus size={15} /> New <ChevronDown size={14} style={{ transform: newOpen ? "rotate(180deg)" : "none" }} />
              </button>
              {newOpen && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", ...glass, background: "rgba(255,255,255,.95)", padding: 6, width: 180, zIndex: 20 }}>
                  <MenuItem icon={FileSignature} title="New Quote" sub="Rate request" />
                  <MenuItem icon={ClipboardList} title="New Booking" sub="Confirmed shipment" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KPI rail */}
        <Card pad={0} style={{ marginBottom: 16, display: "flex", flexWrap: "wrap" }}>
          {KPIS.map((k, i) => (
            <div key={i} style={{ flex: "1 1 16%", padding: "16px 18px", borderLeft: i ? `1px solid ${C.line}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <span style={{ width: 2, height: 11, background: C.faint, borderRadius: 2 }} />
                <span style={{ fontSize: 11.5, color: C.ink2, fontWeight: 450 }}>{k.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                <span style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-.01em" }}>{k.k ? (k.money ? money(k.k.v) : k.k.v) : "—"}</span>
                {k.k && <span style={{ fontSize: 11.5, color: deltaColor(k.k.delta), fontWeight: 500 }}>{k.k.delta}</span>}
              </div>
            </div>
          ))}
        </Card>

        {/* jobs by mode (EA/ES/IA/IS — jobs, not consols) */}
        <Card pad={0} style={{ marginBottom: 16, display: "flex", flexWrap: "wrap" }}>
          {JOBS.map((j, i) => (
            <div key={j.code} style={{ flex: "1 1 24%", padding: "14px 18px", borderLeft: i ? `1px solid ${C.line}` : "none", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: j.accent === ORANGE ? C.orangeSoft : C.navySoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <j.icon size={17} color={j.accent} strokeWidth={1.9} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: C.ink2 }}>{j.label} <span style={{ color: C.mut }}>· {j.code}</span></div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                  <span style={{ fontSize: 20, fontWeight: 600 }}>{j.k ? j.k.v : "—"}</span>
                  {j.k && <span style={{ fontSize: 11, color: deltaColor(j.k.delta), fontWeight: 500 }}>{j.k.delta}</span>}
                </div>
              </div>
            </div>
          ))}
        </Card>

        {/* trends */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <TrendCard title="Air vs Sea Trend" data={trends} s1="Sea" s2="Air" c1={NAVY} c2="#5B8DEF" range={range} />
          <TrendCard title="Imports vs Exports Trend" data={trends} s1="Imports" s2="Exports" c1={ORANGE} c2={NAVY} range={range} />
        </div>

        {/* map + new bookings */}
        <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16, marginBottom: 16 }}>
          <MapCard range={range} />
          <NewBookings rows={newBookings} />
        </div>

        {/* lanes + customers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <TradeLanes range={range} />
          <TopCustomers range={range} />
        </div>

        {/* finance */}
        <FinanceCard finance={finance} range={range} />
      </div>
    </div>
  );
}
