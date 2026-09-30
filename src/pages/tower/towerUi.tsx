import { useEffect, useRef, useState } from "react";
import type React from "react";
import { ArrowRight } from "lucide-react";

export function useReducedMotion() {
  const q = "(prefers-reduced-motion: reduce)";
  const [rm, setRm] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q), f = () => setRm(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return rm;
}

/* Eases from the last shown value to the new one, so refreshes glide instead of jump. */
export function CountUp({ value, format, className, style }: {
  value: number | null | undefined; format?: (n: number) => string; className?: string; style?: React.CSSProperties;
}) {
  const rm = useReducedMotion();
  const target = Number(value ?? 0);
  const [shown, setShown] = useState(rm ? target : 0);
  const from = useRef(0);
  useEffect(() => {
    if (rm) { setShown(target); from.current = target; return; }
    const start = performance.now(), a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 800), e = 1 - Math.pow(1 - p, 3);
      setShown(a + (target - a) * e);
      if (p < 1) raf = requestAnimationFrame(step); else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, rm]);
  const f = format ?? ((n: number) => Math.round(n).toLocaleString());
  return <span className={`tw-num ${className ?? ""}`} style={style}>{value == null ? "—" : f(shown)}</span>;
}

export function Sparkline({ data, color }: { data?: number[] | null; color: string }) {
  if (!data || data.length < 2) return null;
  const w = 160, h = 24, mn = Math.min(...data), mx = Math.max(...data), r = mx - mn || 1;
  const d = data.map((v, i) => `${i ? "L" : "M"}${(i * w / (data.length - 1)).toFixed(1)} ${(h - 3 - ((v - mn) / r) * (h - 6)).toFixed(1)}`).join(" ");
  return (
    <svg className="tw-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${d} L${w} ${h} L0 ${h}Z`} fill={color} opacity={0.08} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

type Tabs = { items: string[]; value: number; onChange: (i: number) => void };

/* Standard widget chrome: title, count, one link, optional underline tabs. */
export function Widget({ title, count, hot, link, onLink, tabs, className, style, children }: {
  title: string; count?: React.ReactNode; hot?: boolean; link?: string; onLink?: () => void; tabs?: Tabs;
  className?: string; style?: React.CSSProperties; children: React.ReactNode;
}) {
  return (
    <section className={`tw-card tw-w ${className ?? ""}`} style={style}>
      <div className="tw-wh">
        <h2>{title}</h2>
        {count != null && <span className={`tw-cnt tw-num${hot ? " tw-cnt--hot" : ""}`}>{count}</span>}
        <span className="tw-gap" />
        {link && <button type="button" className="tw-lnk" onClick={onLink}>{link} <ArrowRight size={14} /></button>}
      </div>
      {tabs && (
        <div className="tw-tabs" role="tablist">
          {tabs.items.map((t, i) => (
            <button key={t} type="button" role="tab" aria-selected={i === tabs.value} onClick={() => tabs.onChange(i)}>{t}</button>
          ))}
        </div>
      )}
      {children}
    </section>
  );
}

export const Skeleton = ({ h = 14, w = "100%" }: { h?: number; w?: number | string }) =>
  <div className="tw-skel" style={{ height: h, width: w }} />;

export const Empty = ({ title, children, icon }: { title: string; children?: React.ReactNode; icon?: React.ReactNode }) => (
  <div className="tw-empty">{icon}<strong>{title}</strong>{children && <span>{children}</span>}</div>
);

/* Shared y-axis gridlines for the small SVG charts. */
export function Axis({ W, H, pl, pb, pt, max, step }: { W: number; H: number; pl: number; pb: number; pt: number; max: number; step: number }) {
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);
  return (
    <>
      {ticks.map((t) => {
        const y = H - pb - (t / max) * (H - pb - pt);
        return (
          <g key={t}>
            <line className="gl" x1={pl} x2={W} y1={y} y2={y} />
            <text x={pl - 6} y={y + 3} textAnchor="end">{t}</text>
          </g>
        );
      })}
    </>
  );
}
export const niceMax = (v: number, step: number) => Math.max(step, Math.ceil(v / step) * step);
