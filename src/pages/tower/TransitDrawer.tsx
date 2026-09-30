import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Plane, Radio, Ship, X } from "lucide-react";
import { fmtDay, titleCase } from "./towerTheme";
import { daysToEta, shipmentNo } from "./transitModel";
import type { TransitShipment } from "./useTower";

export type DrawerState = { list: TransitShipment[] | null; focus: TransitShipment | null };

export function TransitDrawer({ state, onFocus, onBack, onClose }: {
  state: DrawerState; onFocus: (s: TransitShipment) => void; onBack: () => void; onClose: () => void;
}) {
  if (state.focus) return <Peek s={state.focus} backTo={state.list?.length ?? 0} onBack={onBack} onClose={onClose} />;
  const list = [...(state.list ?? [])].sort((a, b) => a.eta.localeCompare(b.eta));
  const imp = list.filter((s) => s.dir === "import").length;
  const live = list.filter((s) => s.live).length;

  return (
    <aside className="tw-drawer" aria-label="Shipments in this area">
      <div className="tw-dh">
        <div>
          <div className="tw-dh__t">{list.length} shipments</div>
          <div className="tw-dh__s">{imp} import · {list.length - imp} export · {live} live AIS</div>
        </div>
        <button type="button" className="tw-ib tw-ib--sm" aria-label="Close" onClick={onClose}><X size={16} /></button>
      </div>
      <ul className="tw-dlist">
        {list.map((s, i) => (
          <li key={s.id} style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}>
            <button type="button" className="tw-drow" onClick={() => onFocus(s)}>
              <span className="tw-drow__m">
                <span className="tw-drow__no tw-num">{shipmentNo(s)}</span>
                <span className="tw-drow__s">{titleCase(s.customer)} · {s.o} → {s.d} · ETA {fmtDay(s.eta)}</span>
              </span>
              <span className={`tw-pill ${s.live ? "tw-pill--live" : "tw-pill--blue"}`}>{s.live ? "Live" : "Est."}</span>
              <ChevronRight size={14} color="var(--faint)" />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

const STEPS = ["Booked", "Departed", "Arrived", "Delivered"];

function Peek({ s, backTo, onBack, onClose }: { s: TransitShipment; backTo: number; onBack: () => void; onClose: () => void }) {
  const nav = useNavigate();
  const pct = Math.round(Math.min(1, Math.max(0, s.frac)) * 100);
  const left = daysToEta(s.eta);
  const facts: [string, string | null][] = [
    ["Customer", titleCase(s.customer)], ["Shipper", titleCase(s.shipper)], ["Consignee", titleCase(s.consignee)],
    ["Vessel / flight", s.vessel], ["Load", s.mode === "sea" ? (s.load_type || "Sea") : "Air"],
    ["Packages", s.pack_qty ? `${Number(s.pack_qty).toLocaleString()} ${titleCase(s.pack_type)}` : null],
    ["Weight", s.kg ? `${Number(s.kg).toLocaleString()} kg` : null], ["Volume", s.cbm ? `${s.cbm} m³` : null],
    ["House bill", s.hbl], ["Master bill", s.mbl], ["Customer ref", s.ref], ["Goods", titleCase(s.goods)],
  ];
  const fix = s.live
    ? new Date(s.live.at).toLocaleString("en-NZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Pacific/Auckland" })
    : null;

  return (
    <aside className="tw-drawer" aria-label={`Shipment ${shipmentNo(s)}`}>
      <div className="tw-dbody">
        {backTo > 1 && <button type="button" className="tw-back" onClick={onBack}><ChevronLeft size={14} /> {backTo} shipments</button>}
        <div className="tw-pk__head">
          <div className="tw-pk__id">
            <span className="tw-pk__mode">{s.mode === "sea" ? <Ship size={16} /> : <Plane size={16} />}</span>
            <div>
              <div className="tw-pk__no tw-num">{shipmentNo(s)}</div>
              <div className="tw-pk__sub">{titleCase(s.customer)} · {s.dir === "import" ? "Import" : "Export"} {s.mode}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="tw-pill tw-pill--blue">In transit</span>
            <button type="button" className="tw-ib tw-ib--sm" aria-label="Close" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div className="tw-route">
          <div className="tw-ends">
            <div>
              <span className="tw-code tw-num">{s.o}</span>
              <span className="tw-city">{s.oname}</span>
              <span className="tw-date">{s.departed ? "Departed" : "ETD"} {fmtDay(s.departed ?? s.etd)}</span>
            </div>
            <div>
              <span className="tw-code tw-num">{s.d}</span>
              <span className="tw-city">{s.dname}</span>
              <span className="tw-date">ETA {fmtDay(s.eta)}</span>
            </div>
          </div>
          <div className="tw-prog"><i style={{ width: `${pct}%` }} /></div>
          <div className="tw-progmeta">
            <span>{pct}% of {s.mode === "sea" ? "voyage" : "flight"}</span>
            <span>{left <= 0 ? "Due today" : left === 1 ? "1 day to ETA" : `${left} days to ETA`}</span>
          </div>
          <ol className="tw-steps" aria-label="Progress">
            {STEPS.map((l, i) => (
              <li key={l} className={i < 2 ? "done" : i === 2 ? "next" : ""}><span className="d" /><span className="lb">{l}</span></li>
            ))}
          </ol>
        </div>

        {s.live ? (
          <div className="tw-ais">
            <Radio size={16} />
            <span>{s.live.ship ?? s.vessel}{s.live.kn != null ? ` · ${Math.round(s.live.kn * 10) / 10} kn` : ""}
              {s.live.hdg != null ? ` · heading ${Math.round(s.live.hdg)}°` : ""} · fix {fix}</span>
          </div>
        ) : (
          <div className="tw-est">Position estimated from ETD and ETA. No AIS fix for this vessel in the last 72 hours.</div>
        )}

        <dl className="tw-facts">
          {facts.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>

        <div className="tw-actions">
          <button type="button" className="tw-btn tw-btn--p" onClick={() => nav(`/shipments/${s.id}`)}>Open job <ArrowRight size={14} /></button>
          {s.acct && <button type="button" className="tw-btn tw-btn--g" onClick={() => nav(`/customers/${encodeURIComponent(s.acct!)}`)}>Customer</button>}
          <button type="button" className="tw-btn tw-btn--g" onClick={() => nav("/messages")}>Messages</button>
        </div>
      </div>
    </aside>
  );
}
