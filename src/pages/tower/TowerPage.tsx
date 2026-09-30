import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, RotateCw } from "lucide-react";
import { TOWER_CSS } from "./towerTheme";
import { TowerRefresh, useCanAny, type Range } from "./useTower";
import { PulseStrip } from "./PulseStrip";
import { TransitMap } from "./TransitMap";
import { ActionQueue, ExceptionsCard } from "./ActionCards";
import { ArrivalsCard, CartageCard, QuotesCard } from "./OpsCards";
import { VolumeCard, TopCustomersCard, CsatCard } from "./TrendCards";
import { ReceivablesCard } from "./ReceivablesCard";

/* ══════ UB FREIGHT · CONTROL TOWER ══════
   Each widget declares the modules that unlock it. Hidden widgets never mount,
   so their RPC never fires, and each row re-splits its 12 columns across what is left. */
type Slot = { id: string; modules: string[]; weight: number; render: (range: Range, style: React.CSSProperties) => React.ReactNode };

const ROWS: Slot[][] = [
  [{ id: "map", modules: ["shipments"], weight: 12, render: (_, s) => <div style={s}><TransitMap /></div> }],
  [
    { id: "actions", modules: ["bookings", "quotes", "rates"], weight: 5, render: (_, s) => <ActionQueue style={s} /> },
    { id: "exceptions", modules: ["bookings", "tms"], weight: 7, render: (_, s) => <ExceptionsCard style={s} /> },
  ],
  [
    { id: "arrivals", modules: ["shipments"], weight: 5, render: (_, s) => <ArrivalsCard style={s} /> },
    { id: "cartage", modules: ["tms"], weight: 4, render: (_, s) => <CartageCard style={s} /> },
    { id: "quotes", modules: ["quotes"], weight: 3, render: (r, s) => <QuotesCard range={r} style={s} /> },
  ],
  [
    { id: "volume", modules: ["shipments"], weight: 7, render: (r, s) => <VolumeCard range={r} style={s} /> },
    { id: "customers", modules: ["customers"], weight: 5, render: (r, s) => <TopCustomersCard range={r} style={s} /> },
  ],
  [
    { id: "csat", modules: ["customers"], weight: 4, render: (_, s) => <CsatCard style={s} /> },
    { id: "ar", modules: ["ar"], weight: 8, render: (_, s) => <ReceivablesCard style={s} /> },
  ],
];

function spans(slots: Slot[]) {
  const sum = slots.reduce((s, x) => s + x.weight, 0);
  const out = slots.map((x) => Math.max(3, Math.round((x.weight / sum) * 12)));
  out[out.indexOf(Math.max(...out))] += 12 - out.reduce((a, b) => a + b, 0);
  return out;
}

const clock = (d: Date) => d.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Pacific/Auckland" });

export default function TowerPage() {
  const nav = useNavigate();
  const [range, setRange] = useState<Range>("week");
  const [tick, setTick] = useState(0);
  const [stamp, setStamp] = useState(() => new Date());
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const can = {
    map: useCanAny(["shipments"]), actions: useCanAny(["bookings", "quotes", "rates"]), exceptions: useCanAny(["bookings", "tms"]),
    arrivals: useCanAny(["shipments"]), cartage: useCanAny(["tms"]), quotes: useCanAny(["quotes"]),
    volume: useCanAny(["shipments"]), customers: useCanAny(["customers"]), csat: useCanAny(["customers"]), ar: useCanAny(["ar"]),
  } as Record<string, boolean>;
  const canQuote = can.quotes, canBook = useCanAny(["bookings"]);
  const rows = ROWS.map((r) => r.filter((s) => can[s.id])).filter((r) => r.length);

  useEffect(() => {
    if (!menu) return;
    const off = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [menu]);

  const refresh = () => { setTick((t) => t + 1); setStamp(new Date()); };

  return (
    <TowerRefresh.Provider value={tick}>
      <div className="tw-root">
        <style>{TOWER_CSS}</style>
        <div className="tw-head">
          <div>
            <div className="tw-crumb">Home › Control Tower</div>
            <h1>Control Tower</h1>
          </div>
          <div className="tw-tools">
            <label className="tw-sel" htmlFor="tw-period">Period
              <select id="tw-period" value={range} onChange={(e) => setRange(e.target.value as Range)}>
                <option value="week">This week</option><option value="month">This month</option><option value="year">This year</option>
              </select>
            </label>
            <span className="tw-stamp">Updated {clock(stamp)}</span>
            <button type="button" className="tw-ib" title="Refresh" aria-label="Refresh" onClick={refresh}><RotateCw size={16} /></button>
            {(canQuote || canBook) && (
              <div ref={menuRef} style={{ position: "relative" }}>
                <button type="button" className="tw-btn tw-btn--p" onClick={() => setMenu((m) => !m)}><Plus size={16} />New</button>
                {menu && (
                  <div className="tw-menu" role="menu">
                    {canQuote && <button type="button" role="menuitem" onClick={() => nav("/quotes/new")}>New quote<small>Rate search</small></button>}
                    {canBook && <button type="button" role="menuitem" onClick={() => nav("/new-booking")}>New booking<small>Confirmed shipment</small></button>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <PulseStrip range={range} />

        <div className="tw-grid">
          {rows.map((r) => {
            const sp = spans(r);
            return r.map((s, i) => <FragmentCell key={s.id}>{s.render(range, { gridColumn: `span ${sp[i]}`, animationDelay: `${i * 60}ms` })}</FragmentCell>);
          })}
        </div>
      </div>
    </TowerRefresh.Provider>
  );
}

const FragmentCell = ({ children }: { children: React.ReactNode }) => <>{children}</>;
