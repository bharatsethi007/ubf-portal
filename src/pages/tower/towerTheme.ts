/* ══════ Control Tower · tokens + styles (customer-portal language) ══════
   One style tag, scoped under .tw-root. Navy #0B1A3A, blue #2563EB, slate neutrals,
   12px panels, soft shadow. Motion is short and stops once content is in place. */

export const C = {
  navy: "#0B1A3A", navy2: "#13254F", orange: "#F7941D", blue: "#2563EB", blue2: "#93B4F5",
  green: "#15803D", live: "#059669", amber: "#B45309", red: "#B42318",
  ink: "#0F172A", ink2: "#334155", muted: "#64748B", faint: "#94A3B8", line: "#E2E8F0", lineSoft: "#EEF2F6",
};

export const money = (n?: number | null) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (Math.abs(v) >= 1e3) return "$" + Math.round(v / 1e3) + "k";
  return "$" + Math.round(v);
};
export const isDown = (d?: string | null) => !!d && (d.startsWith("−") || d.startsWith("-"));
export const titleCase = (s?: string | null) =>
  (s || "").toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bNz\b/g, "NZ");
export const fmtDay = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short" }) : "—";

export const TOWER_CSS = `
.tw-root{--navy:${C.navy};--navy-2:${C.navy2};--orange:${C.orange};--blue:${C.blue};--blue-soft:#EFF4FF;--blue-2:${C.blue2};
--green:${C.green};--green-soft:#ECFDF3;--live:${C.live};--live-soft:#E7F8F1;--amber:${C.amber};--amber-soft:#FFF7E6;--red:${C.red};--red-soft:#FEF3F2;
--ink:${C.ink};--ink-2:${C.ink2};--muted:${C.muted};--faint:${C.faint};--line:${C.line};--line-soft:${C.lineSoft};--bg:#F6F7F9;
--ease:cubic-bezier(.2,.7,.2,1);--shadow:0 1px 2px rgba(15,23,42,.04),0 1px 3px rgba(15,23,42,.06);--shadow-lg:0 12px 32px rgba(15,23,42,.10);
font-family:'Inter Variable',Inter,system-ui,-apple-system,'Segoe UI',sans-serif;font-feature-settings:'cv11','ss01';color:var(--ink-2);font-size:13px;
display:flex;flex-direction:column;gap:18px;padding:4px 4px 40px;-webkit-font-smoothing:antialiased}
.tw-root *{box-sizing:border-box}
.tw-num{font-variant-numeric:tabular-nums;font-feature-settings:'tnum';letter-spacing:-.01em}
@keyframes tw-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes tw-slidein{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}
@keyframes tw-pop{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:none}}
@keyframes tw-gy{from{transform:scaleY(0)}}
@keyframes tw-gx{from{transform:scaleX(0)}}
@keyframes tw-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
.tw-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap}
.tw-crumb{font-size:12px;color:var(--muted);margin-bottom:4px}
.tw-head h1{margin:0;font-size:24px;font-weight:600;letter-spacing:-.02em;color:var(--ink)}
.tw-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.tw-sel{display:inline-flex;align-items:center;gap:6px;height:36px;border:1px solid var(--line);background:#fff;border-radius:8px;padding:0 10px;font-size:13px;color:var(--muted)}
.tw-sel select{border:0;background:transparent;color:var(--ink);font:inherit;font-weight:500;cursor:pointer}
.tw-sel select:focus{outline:none}
.tw-stamp{font-size:12px;color:var(--muted)}
.tw-btn{height:36px;padding:0 14px;border-radius:8px;border:1px solid transparent;display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;text-decoration:none;transition:background .15s,border-color .15s,transform .1s}
.tw-btn:active{transform:scale(.98)}
.tw-btn--p{background:var(--navy);color:#fff}.tw-btn--p:hover{background:var(--navy-2)}
.tw-btn--g{background:#fff;border-color:var(--line);color:var(--ink)}.tw-btn--g:hover{border-color:#CBD5E1}
.tw-ib{width:36px;height:36px;border-radius:8px;border:1px solid var(--line);background:#fff;color:var(--ink-2);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
.tw-ib:hover{background:var(--bg)}
.tw-ib--sm{width:30px;height:30px}
.tw-root button:focus-visible,.tw-root select:focus-visible,.tw-root [tabindex]:focus-visible{outline:2px solid var(--blue);outline-offset:1px}
.tw-menu{position:absolute;right:0;top:calc(100% + 6px);min-width:220px;padding:6px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow-lg);z-index:30;animation:tw-pop .16s var(--ease) both}
.tw-menu button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;padding:9px 10px;border:0;border-radius:8px;background:transparent;font:inherit;font-size:13px;color:var(--ink);cursor:pointer;text-align:left}
.tw-menu button:hover{background:var(--bg)}
.tw-menu small{font-size:12px;color:var(--muted)}

.tw-card{background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);min-width:0;animation:tw-rise .5s var(--ease) both}
.tw-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.tw-kpi{padding:16px 18px 12px;display:flex;flex-direction:column;gap:4px}
.tw-kpi__l{font-size:12px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.tw-kpi__v{font-size:28px;font-weight:600;color:var(--ink);letter-spacing:-.02em}
.tw-kpi__s{font-size:12px;color:var(--muted)}
.tw-up{color:var(--green)}.tw-dn{color:var(--red)}
.tw-spark{display:block;width:100%;height:24px;margin-top:4px}

.tw-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px}
@media (max-width:1100px){.tw-grid>*{grid-column:span 12!important}}
.tw-w{display:flex;flex-direction:column}
.tw-wh{display:flex;align-items:center;gap:8px;min-height:52px;padding:0 10px 0 18px;border-bottom:1px solid var(--line-soft)}
.tw-wh h2{margin:0;font-size:14px;font-weight:600;color:var(--ink)}
.tw-cnt{font-size:12px;font-weight:500;padding:1px 8px;border-radius:999px;background:var(--line-soft);color:var(--ink-2)}
.tw-cnt--hot{background:var(--red-soft);color:var(--red)}
.tw-gap{flex:1}
.tw-lnk{display:inline-flex;align-items:center;gap:4px;color:var(--blue);font:inherit;font-size:13px;font-weight:500;background:none;border:0;cursor:pointer;padding:4px 8px;border-radius:6px}
.tw-lnk:hover{text-decoration:underline}
.tw-wb{padding:16px 18px 18px;flex:1;min-width:0}
.tw-wb--flush{padding:0}
.tw-tabs{display:flex;gap:4px;padding:0 14px;border-bottom:1px solid var(--line-soft);overflow-x:auto}
.tw-tabs button{border:0;background:none;padding:10px 6px 9px;font:inherit;font-size:12.5px;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap}
.tw-tabs button[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--orange);font-weight:500}

.tw-tw{overflow-x:auto}
.tw-t{width:100%;border-collapse:collapse;font-size:13px}
.tw-t th{font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);text-align:left;padding:10px 18px;border-bottom:1px solid var(--line-soft);white-space:nowrap}
.tw-t td{padding:11px 18px;border-bottom:1px solid var(--line-soft);white-space:nowrap}
.tw-t tr:last-child td{border-bottom:0}
.tw-t tbody tr{cursor:pointer;transition:background .12s;animation:tw-rise .4s var(--ease) both}
.tw-t tbody tr:hover{background:var(--bg)}
.tw-t .r{text-align:right}.tw-t .m{color:var(--muted)}.tw-t .ink{color:var(--ink)}
.tw-t .name{max-width:260px;overflow:hidden;text-overflow:ellipsis;color:var(--ink)}
.tw-pill{display:inline-block;font-size:12px;font-weight:500;padding:2px 9px;border-radius:999px;white-space:nowrap}
.tw-pill--grey{background:#F1F5F9;color:#475569}.tw-pill--blue{background:var(--blue-soft);color:#1D4ED8}.tw-pill--green{background:var(--green-soft);color:var(--green)}
.tw-pill--amber{background:var(--amber-soft);color:var(--amber)}.tw-pill--red{background:var(--red-soft);color:var(--red)}.tw-pill--live{background:var(--live-soft);color:var(--live)}
.tw-badge{display:inline-flex;min-width:28px;justify-content:center;font-size:12.5px;font-weight:500;padding:2px 8px;border-radius:999px}
.tw-badge--on{background:var(--navy);color:#fff}.tw-badge--off{background:var(--line-soft);color:var(--faint)}
.tw-skel{background:linear-gradient(90deg,var(--line-soft) 0,#fff 200px,var(--line-soft) 400px);background-size:800px 100%;animation:tw-shimmer 1.2s infinite linear;border-radius:8px}
.tw-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6px;padding:26px 12px;color:var(--muted);height:100%}
.tw-empty strong{color:var(--ink);font-weight:500;font-size:13.5px}

.tw-chart text{font-size:10.5px;fill:var(--faint)}
.tw-chart .gl{stroke:var(--line-soft)}
.tw-grow{transform-box:fill-box;transform-origin:bottom;animation:tw-gy .55s var(--ease) both}
.tw-growx{transform-box:fill-box;transform-origin:left;animation:tw-gx .55s var(--ease) both}
.tw-leg{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--ink-2);margin-top:10px}
.tw-leg span{display:inline-flex;align-items:center;gap:6px}
.tw-leg i{width:10px;height:10px;border-radius:3px;display:inline-block}
.tw-sbar{display:flex;height:10px;border-radius:99px;overflow:hidden;gap:2px;background:var(--line-soft)}
.tw-sbar i{display:block}
.tw-rowx{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-top:1px solid var(--line-soft);font-size:13px}
.tw-rowx:first-of-type{border-top:0}
.tw-rowx span{display:inline-flex;align-items:center;gap:8px}
.tw-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
.tw-note{display:flex;gap:8px;align-items:center;background:var(--amber-soft);color:var(--amber);border-radius:8px;padding:9px 11px;font-size:12.5px;margin-top:12px}
.tw-sum{display:flex;gap:26px;padding-top:12px;margin-top:14px;border-top:1px solid var(--line-soft)}
.tw-sum div{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.tw-sum span{display:block;font-size:20px;font-weight:600;color:var(--ink);text-transform:none;letter-spacing:-.01em}
.tw-buckets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0 4px}
.tw-buckets div{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;display:flex;flex-direction:column;gap:2px}
.tw-buckets span.v{font-size:18px;color:var(--ink);font-weight:600;text-transform:none;letter-spacing:-.01em}
@media (max-width:640px){.tw-buckets{grid-template-columns:repeat(2,1fr)}}
.tw-hidden{font-size:12px;color:var(--muted)}
@media (prefers-reduced-motion:reduce){.tw-root *,.tw-root *::before,.tw-root *::after{animation:none!important;transition:none!important}}
`;
