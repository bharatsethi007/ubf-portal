/* System Health styles. Layered on TOWER_CSS (same tokens, scoped under .tw-root). */
export const HEALTH_CSS = `
.sh-hero{display:grid;grid-template-columns:minmax(260px,1.1fr) repeat(4,minmax(150px,1fr));gap:12px}
@media (max-width:1200px){.sh-hero{grid-template-columns:repeat(2,minmax(0,1fr))}.sh-hero>.sh-status{grid-column:span 2}}
.sh-status{position:relative;overflow:hidden;padding:18px 20px;display:flex;flex-direction:column;justify-content:space-between;gap:10px;
  background:linear-gradient(135deg,var(--navy) 0%,#1B2F66 100%);color:#fff;border:0}
.sh-status::after{content:"";position:absolute;right:-60px;top:-60px;width:200px;height:200px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,255,255,.10),transparent 70%)}
.sh-status__l{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;opacity:.7}
.sh-status__v{display:flex;align-items:center;gap:10px;font-size:22px;font-weight:600;letter-spacing:-.02em}
.sh-status__s{font-size:12.5px;opacity:.75}
.sh-status .sh-dot{width:12px;height:12px}

.sh-tabs{display:flex;gap:2px;border-bottom:1px solid var(--line);margin-top:2px}
.sh-tabs button{display:inline-flex;align-items:center;gap:7px;border:0;background:none;padding:11px 14px 10px;font:inherit;font-size:13.5px;
  color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .15s}
.sh-tabs button:hover{color:var(--ink)}
.sh-tabs button[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--orange);font-weight:500}
.sh-tabs .tw-cnt{font-size:11px}

.sh-dot{width:9px;height:9px;border-radius:50%;display:inline-block;flex-shrink:0;position:relative}
.sh-dot--ok{background:#12B76A}.sh-dot--warn{background:#F79009}.sh-dot--bad{background:#F04438}.sh-dot--idle{background:#CBD5E1}
.sh-dot--pulse::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid currentColor;opacity:0;animation:sh-ping 2s ease-out infinite}
.sh-dot--ok.sh-dot--pulse{color:#12B76A}.sh-dot--bad.sh-dot--pulse{color:#F04438}.sh-dot--warn.sh-dot--pulse{color:#F79009}
@keyframes sh-ping{0%{transform:scale(.6);opacity:.7}80%,100%{transform:scale(1.8);opacity:0}}

.sh-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;padding:3px 10px 3px 8px;border-radius:999px;white-space:nowrap}
.sh-pill--ok{background:var(--green-soft);color:var(--green)}.sh-pill--warn{background:var(--amber-soft);color:var(--amber)}
.sh-pill--bad{background:var(--red-soft);color:var(--red)}.sh-pill--idle{background:#F1F5F9;color:#64748B}

.sh-cat{display:flex;align-items:center;gap:8px;margin:6px 2px 10px;font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
.sh-cat::after{content:"";flex:1;height:1px;background:var(--line)}
.sh-apis{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-bottom:18px}
.sh-api{padding:14px 16px 12px;display:flex;flex-direction:column;gap:10px;cursor:pointer;text-align:left;font:inherit;color:inherit;
  transition:border-color .15s,box-shadow .15s,transform .15s}
.sh-api:hover{border-color:#CBD5E1;box-shadow:var(--shadow-lg);transform:translateY(-1px)}
.sh-api__top{display:flex;align-items:center;gap:10px}
.sh-api__logo{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;
  color:var(--navy);background:var(--blue-soft);flex-shrink:0}
.sh-api__name{font-size:14px;font-weight:600;color:var(--ink);line-height:1.2}
.sh-api__sub{font-size:11.5px;color:var(--muted)}
.sh-api__stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.sh-api__stats div{display:flex;flex-direction:column;gap:1px;font-size:10.5px;color:var(--faint);text-transform:uppercase;letter-spacing:.04em}
.sh-api__stats b{font-size:15px;font-weight:600;color:var(--ink);letter-spacing:-.01em;text-transform:none}
.sh-api__stats b.bad{color:var(--red)}
.sh-api__foot{display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:var(--muted);gap:8px}
.sh-api__err{font-size:11.5px;color:var(--red);background:var(--red-soft);border-radius:6px;padding:5px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sh-star{color:var(--orange);font-size:11px}

.sh-bars{display:flex;align-items:flex-end;gap:2px;height:28px}
.sh-bars__b{flex:1;border-radius:2px 2px 0 0;transform-origin:bottom;animation:tw-gy .5s var(--ease) both}
.sh-bars__b--ok{background:#93B4F5}.sh-bars__b--warn{background:#FEC84B}.sh-bars__b--bad{background:#FDA29B}.sh-bars__b--idle{background:var(--line-soft)}

.sh-gauge{display:flex;align-items:center;gap:14px}
.sh-gauge__arc{transition:stroke-dasharray .9s var(--ease)}
.sh-gauge__arc--ok{stroke:var(--navy)}.sh-gauge__arc--warn{stroke:#F79009}.sh-gauge__arc--bad{stroke:#F04438}.sh-gauge__arc--idle{stroke:#CBD5E1}
.sh-gauge__v{font-size:19px;font-weight:600;fill:var(--ink);font-family:inherit}
.sh-gauge__l{font-size:13px;font-weight:600;color:var(--ink)}
.sh-gauge__s{font-size:12px;color:var(--muted);margin-top:2px}
.sh-gauges{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}

.sh-share{padding:8px 0}
.sh-share__top{display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px;gap:10px}
.sh-share__l{color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sh-share__track{height:7px;border-radius:99px;background:var(--line-soft);overflow:hidden}
.sh-share__fill{display:block;height:100%;border-radius:99px;transform-origin:left;animation:tw-gx .7s var(--ease) both}
.sh-share__fill--ok{background:var(--navy)}.sh-share__fill--warn{background:#F79009}.sh-share__fill--bad{background:#F04438}.sh-share__fill--idle{background:#CBD5E1}

.sh-mono{margin:0;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.55;
  background:#0B1220;color:#D5DEEE;border-radius:8px;padding:12px 14px;max-height:360px;overflow:auto;white-space:pre-wrap;word-break:break-word}

.sh-drawer-bg{position:fixed;inset:0;background:rgba(11,26,58,.28);z-index:60;animation:tw-pop .15s ease both}
.sh-drawer{position:fixed;top:0;right:0;bottom:0;width:min(860px,100vw);background:#fff;z-index:61;display:flex;flex-direction:column;
  box-shadow:-20px 0 48px rgba(15,23,42,.18);animation:tw-slidein .25s var(--ease) both}
.sh-drawer__head{display:flex;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid var(--line)}
.sh-drawer__head h2{margin:0;font-size:17px;font-weight:600;color:var(--ink)}
.sh-drawer__tools{display:flex;gap:8px;align-items:center;padding:10px 20px;border-bottom:1px solid var(--line-soft);flex-wrap:wrap}
.sh-drawer__body{flex:1;overflow:auto}
.sh-seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.sh-seg button{border:0;background:#fff;padding:6px 12px;font:inherit;font-size:12.5px;color:var(--muted);cursor:pointer}
.sh-seg button[aria-pressed="true"]{background:var(--navy);color:#fff}

.sh-log td{vertical-align:top}
.sh-log tr.sh-open td{background:var(--bg)}
.sh-detail{padding:4px 18px 16px;background:var(--bg)}
.sh-detail h4{margin:10px 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}

.sh-timeline{display:flex;flex-direction:column}
.sh-run{display:grid;grid-template-columns:22px 1fr auto;gap:12px;padding:12px 18px;border-bottom:1px solid var(--line-soft);cursor:pointer;transition:background .12s}
.sh-run:hover{background:var(--bg)}
.sh-run__rail{display:flex;flex-direction:column;align-items:center;padding-top:4px}
.sh-run__t{font-size:13px;font-weight:500;color:var(--ink)}
.sh-run__s{font-size:12px;color:var(--muted);margin-top:2px}
.sh-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.sh-chip{font-size:11.5px;padding:2px 8px;border-radius:6px;background:var(--line-soft);color:var(--ink-2)}

.sh-fresh{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
.sh-fresh__c{padding:14px 16px;display:flex;flex-direction:column;gap:6px}
.sh-fresh__l{font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;gap:7px}
.sh-fresh__v{font-size:20px;font-weight:600;color:var(--ink);letter-spacing:-.02em}
.sh-fresh__s{font-size:12px;color:var(--muted)}

.sh-banner{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border-radius:12px;font-size:13px;line-height:1.5}
.sh-banner--warn{background:var(--amber-soft);color:#7A4A06;border:1px solid #FEDF89}
.sh-banner--bad{background:var(--red-soft);color:#7A271A;border:1px solid #FECDCA}
.sh-banner--info{background:var(--blue-soft);color:#1E3A8A;border:1px solid #C7D7FE}
.sh-banner b{font-weight:600}
.sh-banner code{background:rgba(255,255,255,.7);padding:1px 5px;border-radius:4px;font-size:12px}

.sh-chart{width:100%;height:180px;display:block}
.sh-chart path.area{fill:url(#sh-grad)}
.sh-chart path.line{fill:none;stroke:var(--navy);stroke-width:2;vector-effect:non-scaling-stroke}
.sh-spin{animation:sh-rot 1s linear infinite}
@keyframes sh-rot{to{transform:rotate(360deg)}}
`
