/* System Health · Better Stack style, light. Scoped under .bs-root.
   Neutral zinc greys, one violet accent, 1px borders, no shadows, mono for machine text. */
export const BS = {
  ink: '#18181B', ink2: '#3F3F46', muted: '#71717A', faint: '#A1A1AA', line: '#E4E4E7', line2: '#F1F1F3',
  bg: '#F8F8F9', panel: '#FFFFFF', accent: '#6D5DF5', accentSoft: '#F1EFFE',
  green: '#16A34A', greenSoft: '#ECFDF3', amber: '#D97706', amberSoft: '#FFF8EB', red: '#DC2626', redSoft: '#FEF2F2',
  info: '#C7CBF5', warn: '#F8C46B', error: '#F28B82',
}

export const BS_CSS = `
.bs-root{--ink:${BS.ink};--ink-2:${BS.ink2};--muted:${BS.muted};--faint:${BS.faint};--line:${BS.line};--line-soft:${BS.line2};
--bg:${BS.bg};--accent:${BS.accent};--accent-soft:${BS.accentSoft};--navy:${BS.ink};--navy-2:#27272A;--blue:${BS.accent};--blue-soft:${BS.accentSoft};
--green:${BS.green};--green-soft:${BS.greenSoft};--amber:${BS.amber};--amber-soft:${BS.amberSoft};--red:${BS.red};--red-soft:${BS.redSoft};
--orange:${BS.accent};--shadow:none;--shadow-lg:0 12px 32px rgba(24,24,27,.10);--ease:cubic-bezier(.2,.7,.2,1);
--mono:'JetBrains Mono','Geist Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
display:grid;grid-template-columns:232px minmax(0,1fr);min-height:calc(100vh - 64px);background:var(--bg);color:var(--ink-2);
font-family:'Inter Variable',Inter,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:13px;-webkit-font-smoothing:antialiased;
border:1px solid var(--line);border-radius:12px;overflow:hidden}
.bs-root *{box-sizing:border-box}
@media (max-width:900px){.bs-root{grid-template-columns:1fr}.bs-side{display:none}}
.bs-mono{font-family:var(--mono);font-feature-settings:'zero','ss01'}
.bs-num{font-variant-numeric:tabular-nums}

/* sidebar */
.bs-side{background:#FCFCFD;border-right:1px solid var(--line);display:flex;flex-direction:column;padding:14px 10px}
.bs-brand{display:flex;align-items:center;gap:9px;padding:4px 8px 16px;font-weight:600;color:var(--ink);font-size:14px}
.bs-brand i{width:24px;height:24px;border-radius:7px;background:linear-gradient(135deg,#7C6CF7,#5B4BE6);display:inline-flex;align-items:center;justify-content:center;color:#fff}
.bs-sec{font-size:11px;font-weight:500;color:var(--faint);padding:14px 10px 6px;letter-spacing:.02em}
.bs-nav{display:flex;align-items:center;gap:9px;width:100%;border:0;background:none;padding:7px 10px;border-radius:7px;font:inherit;font-size:13px;color:var(--ink-2);cursor:pointer;text-align:left}
.bs-nav:hover{background:var(--line-soft);color:var(--ink)}
.bs-nav[aria-current="page"]{background:#fff;color:var(--ink);font-weight:500;box-shadow:0 0 0 1px var(--line),0 1px 2px rgba(24,24,27,.04)}
.bs-nav svg{color:var(--muted);flex-shrink:0}.bs-nav[aria-current="page"] svg{color:var(--accent)}
.bs-nav .bs-badge{margin-left:auto}
.bs-badge{font-size:11px;font-weight:600;min-width:20px;height:18px;padding:0 6px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;background:var(--line-soft);color:var(--muted)}
.bs-badge--red{background:var(--red);color:#fff}
.bs-side-foot{margin-top:auto;border:1px solid var(--line);border-radius:9px;padding:10px 12px;background:#fff;display:flex;flex-direction:column;gap:4px}
.bs-side-foot b{font-size:12.5px;color:var(--ink);font-weight:600;display:flex;align-items:center;gap:7px}
.bs-side-foot span{font-size:11.5px;color:var(--muted)}

/* main */
.bs-main{display:flex;flex-direction:column;min-width:0}
.bs-head{height:56px;display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--line);background:#fff}
.bs-head h1{margin:0;font-size:15px;font-weight:600;color:var(--ink);letter-spacing:-.01em}
.bs-crumb{font-size:13px;color:var(--faint)}.bs-crumb a{color:var(--muted);text-decoration:none}.bs-crumb a:hover{color:var(--ink)}
.bs-gap{flex:1}
.bs-body{padding:18px 20px 32px;display:flex;flex-direction:column;gap:14px;min-width:0}
.bs-body.tw-root{padding:18px 20px 32px;gap:14px;font-family:inherit}

/* controls */
.bs-btn{height:32px;padding:0 12px;border-radius:7px;border:1px solid var(--line);background:#fff;color:var(--ink);font:inherit;font-size:13px;font-weight:500;
display:inline-flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;transition:background .12s,border-color .12s}
.bs-btn:hover{background:var(--line-soft)}.bs-btn:disabled{opacity:.5;cursor:default}
.bs-btn--p{background:var(--ink);border-color:var(--ink);color:#fff}.bs-btn--p:hover{background:#27272A}
.bs-ib{width:32px;padding:0;justify-content:center}
.bs-seg{display:inline-flex;border:1px solid var(--line);border-radius:7px;background:#fff;padding:2px;gap:2px}
.bs-seg button{border:0;background:none;height:26px;padding:0 10px;border-radius:5px;font:inherit;font-size:12.5px;color:var(--muted);cursor:pointer}
.bs-seg button:hover{color:var(--ink)}
.bs-seg button[aria-pressed="true"]{background:var(--line-soft);color:var(--ink);font-weight:500}
.bs-search{flex:1;min-width:220px;height:34px;display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:0 10px;transition:border-color .12s,box-shadow .12s}
.bs-search:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.bs-search input{flex:1;border:0;outline:0;background:none;font-family:var(--mono);font-size:12.5px;color:var(--ink)}
.bs-search input::placeholder{color:var(--faint)}
.bs-kbd{font-family:var(--mono);font-size:11px;color:var(--faint);border:1px solid var(--line);border-radius:4px;padding:0 5px}
.bs-live{display:inline-flex;align-items:center;gap:7px}
.bs-live[aria-pressed="true"]{border-color:#BBF7D0;background:var(--green-soft);color:#166534}
.bs-chip{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;border-radius:6px;background:var(--accent-soft);color:#4C3FD1;font-size:12px;font-weight:500}
.bs-chip button{border:0;background:none;color:inherit;cursor:pointer;padding:0;display:inline-flex}

/* panels */
.bs-panel{background:#fff;border:1px solid var(--line);border-radius:10px;min-width:0}
.bs-ph{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line-soft)}
.bs-ph h2{margin:0;font-size:13.5px;font-weight:600;color:var(--ink)}
.bs-ph small{color:var(--muted);font-size:12px}

/* dots + pills */
.bs-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0;position:relative}
.bs-dot--ok{background:#22C55E}.bs-dot--warn{background:#F59E0B}.bs-dot--bad{background:#EF4444}.bs-dot--idle{background:#D4D4D8}
.bs-dot--pulse::after{content:"";position:absolute;inset:-4px;border-radius:50%;background:currentColor;opacity:.25;animation:bs-ping 1.8s ease-out infinite}
.bs-dot--ok.bs-dot--pulse{color:#22C55E}.bs-dot--bad.bs-dot--pulse{color:#EF4444}.bs-dot--warn.bs-dot--pulse{color:#F59E0B}
@keyframes bs-ping{0%{transform:scale(.5);opacity:.5}100%{transform:scale(2.2);opacity:0}}
.bs-lvl{display:inline-flex;align-items:center;justify-content:center;width:46px;height:18px;border-radius:4px;font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.03em}
.bs-lvl--info{background:#EEF2FF;color:#4F46E5}.bs-lvl--warn{background:var(--amber-soft);color:#B45309}.bs-lvl--error{background:var(--red-soft);color:#B91C1C}
.bs-src{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-2);white-space:nowrap}
.bs-src i{width:8px;height:8px;border-radius:2px;display:inline-block}

/* sources rail */
.bs-logs{display:grid;grid-template-columns:200px minmax(0,1fr);gap:14px;align-items:start}
@media (max-width:1100px){.bs-logs{grid-template-columns:1fr}}
.bs-sources{padding:8px}
.bs-srow{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;padding:6px 8px;border-radius:6px;font:inherit;font-size:12.5px;color:var(--ink-2);cursor:pointer;text-align:left}
.bs-srow:hover{background:var(--line-soft)}
.bs-srow[aria-pressed="true"]{background:var(--accent-soft);color:var(--ink)}
.bs-srow .n{margin-left:auto;font-family:var(--mono);font-size:11.5px;color:var(--faint)}
.bs-srow .e{font-family:var(--mono);font-size:11px;color:var(--red)}

/* histogram */
.bs-hist{padding:12px 16px 8px}
.bs-hist svg{display:block;width:100%;height:96px}
.bs-hist rect{transition:opacity .12s}
.bs-hist g.col:hover rect{opacity:.75}
.bs-hist .ax{font-family:var(--mono);font-size:10px;fill:var(--faint)}
.bs-hist .gl{stroke:var(--line-soft)}
.bs-legend{display:flex;gap:14px;font-size:12px;color:var(--muted);align-items:center}
.bs-legend span{display:inline-flex;align-items:center;gap:6px}.bs-legend i{width:8px;height:8px;border-radius:2px}

/* stream */
.bs-stream{font-family:var(--mono);font-size:12.5px;line-height:1.5}
.bs-line{display:grid;grid-template-columns:18px 132px 52px 130px minmax(0,1fr);gap:10px;align-items:center;padding:4px 16px;border-bottom:1px solid var(--line-soft);cursor:pointer;transition:background .1s}
.bs-line:hover{background:#FAFAFB}
.bs-line.open{background:#F7F6FF}
.bs-line.fresh{animation:bs-fresh 1.6s ease-out}
@keyframes bs-fresh{from{background:#ECFDF3}to{background:transparent}}
.bs-line .t{color:var(--faint);white-space:nowrap}
.bs-line .m{color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bs-line .m b{font-weight:500;color:var(--muted)}
.bs-line .chev{color:var(--faint)}
.bs-detail{padding:10px 16px 14px 44px;background:#FBFBFE;border-bottom:1px solid var(--line-soft)}
.bs-kv{display:grid;grid-template-columns:140px minmax(0,1fr);gap:4px 14px;font-family:var(--mono);font-size:12px}
.bs-kv dt{color:var(--muted)}.bs-kv dd{margin:0;color:var(--ink);word-break:break-word;white-space:pre-wrap}
.bs-json{margin:8px 0 0;font-family:var(--mono);font-size:12px;line-height:1.55;background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px 12px;max-height:340px;overflow:auto;white-space:pre-wrap;word-break:break-word;color:var(--ink-2)}
.bs-json .k{color:#7C3AED}.bs-json .s{color:#15803D}.bs-json .n{color:#2563EB}.bs-json .b{color:#B45309}
.bs-more{display:flex;justify-content:center;padding:10px}
.bs-empty{padding:40px 16px;text-align:center;color:var(--muted);font-size:13px}
.bs-empty b{display:block;color:var(--ink);font-weight:500;margin-bottom:4px}

/* monitors */
.bs-mon{width:100%;border-collapse:collapse}
.bs-mon th{font-size:11.5px;font-weight:500;color:var(--faint);text-align:left;padding:10px 16px;border-bottom:1px solid var(--line-soft);white-space:nowrap}
.bs-mon td{padding:12px 16px;border-bottom:1px solid var(--line-soft);white-space:nowrap;vertical-align:middle}
.bs-mon tr:last-child td{border-bottom:0}
.bs-mon tbody tr{cursor:pointer;transition:background .1s}.bs-mon tbody tr:hover{background:#FAFAFB}
.bs-mon .name{font-weight:500;color:var(--ink);font-size:13.5px}
.bs-mon .sub{font-size:12px;color:var(--muted);margin-top:1px}
.bs-mon .r{text-align:right}
.bs-up{display:flex;gap:2px;align-items:flex-end;height:26px}
.bs-up i{width:5px;height:100%;border-radius:2px;background:#E4E4E7}
.bs-up i.ok{background:#4ADE80}.bs-up i.warn{background:#FBBF24}.bs-up i.bad{background:#F87171}
.bs-up i:hover{opacity:.7}

/* incidents */
.bs-inc{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line-soft)}
.bs-inc:last-child{border-bottom:0}
.bs-inc .ic{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center}
.bs-inc .ic.bad{background:var(--red-soft);color:var(--red)}.bs-inc .ic.warn{background:var(--amber-soft);color:var(--amber)}.bs-inc .ic.ok{background:var(--green-soft);color:var(--green)}
.bs-inc h3{margin:0;font-size:13.5px;font-weight:600;color:var(--ink)}
.bs-inc p{margin:3px 0 0;font-size:12.5px;color:var(--muted);line-height:1.45}
.bs-inc .meta{font-family:var(--mono);font-size:11.5px;color:var(--faint);text-align:right;line-height:1.6}
.bs-state{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;padding:2px 9px 2px 7px;border-radius:999px}
.bs-state--open{background:var(--red-soft);color:var(--red)}.bs-state--res{background:var(--green-soft);color:var(--green)}
.bs-field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
.bs-field label{font-size:12px;font-weight:500;color:var(--ink)}
.bs-field small{font-size:11.5px;color:var(--muted)}
.bs-input{height:34px;border:1px solid var(--line);border-radius:7px;padding:0 10px;font:inherit;font-size:13px;color:var(--ink);background:#fff;outline:0;width:100%}
.bs-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
textarea.bs-input{height:auto;min-height:76px;padding:8px 10px;font-family:var(--mono);font-size:12.5px;resize:vertical}
.bs-toggle{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ink);cursor:pointer}
.bs-toggle input{width:16px;height:16px;accent-color:var(--accent)}

/* re-skin the older tabs (tower widgets) to match */
.bs-root .tw-card{box-shadow:none;border-radius:10px;border-color:var(--line);animation:none}
.bs-root .tw-wh{min-height:46px}
.bs-root .tw-kpi__l,.bs-root .tw-t th{text-transform:none;letter-spacing:0;font-size:12px}
.bs-root .tw-kpi__v{font-size:24px}
.bs-root .tw-pill--green{background:var(--green-soft)}.bs-root .tw-pill--red{background:var(--red-soft)}
.bs-root .sh-mono{background:#FBFBFE;color:var(--ink-2);border:1px solid var(--line)}
.bs-root .sh-share__fill--ok{background:var(--accent)}
.bs-root .sh-gauge__arc--ok{stroke:var(--accent)}
.bs-root .sh-bars__b--ok{background:#C7CBF5}
.bs-root .sh-banner{border-radius:10px}
.bs-spin{animation:bs-rot 1s linear infinite}@keyframes bs-rot{to{transform:rotate(360deg)}}
`
