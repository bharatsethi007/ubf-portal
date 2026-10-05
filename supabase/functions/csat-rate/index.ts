// csat-rate — self-hosted public CSAT rating page + submit handler.
// GET  = render the rating page (score preselected from ?score=). No auto-submit (Safe Links prefetch safe).
// POST = record via csat_submit RPC (service role). rep may be an email (contains @) or initials.
// Public by design: verify_jwt = false.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

function db(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const clampScore = (v: string | null): number => {
  const n = parseInt(v ?? "", 10);
  return n >= 1 && n <= 5 ? n : 0;
};

function page(rep: string, score: number, ref: string, channel: string): string {
  const cfg = JSON.stringify({ rep, score, ref, channel });
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Rate your experience — UB Freight</title>
<style>
  :root{--navy:#0A2472;--ink:#1b2330;--muted:#6b7280;--line:#e5e7eb;--ok:#0a7d33}
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
    background:#f4f6fb;color:var(--ink);display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px}
  .card{background:#fff;max-width:440px;width:100%;border:1px solid var(--line);border-radius:16px;
    padding:28px;box-shadow:0 10px 30px rgba(10,36,114,.08)}
  .brand{font-weight:700;color:var(--navy);font-size:15px;letter-spacing:.02em;margin-bottom:4px}
  h1{font-size:20px;margin:6px 0 2px}
  p.sub{color:var(--muted);font-size:14px;margin:0 0 18px}
  .faces{display:flex;justify-content:space-between;gap:6px;margin:8px 0 6px}
  .face{flex:1;font-size:30px;line-height:1;background:transparent;border:2px solid transparent;
    border-radius:12px;padding:10px 0;cursor:pointer;transition:.12s;filter:grayscale(.6);opacity:.7}
  .face:hover{filter:grayscale(0);opacity:1}
  .face.sel{filter:grayscale(0);opacity:1;border-color:var(--navy);background:#eef1fb;transform:translateY(-2px)}
  .scale{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:16px;padding:0 4px}
  textarea{width:100%;border:1px solid var(--line);border-radius:10px;padding:10px;font:inherit;font-size:14px;resize:vertical;min-height:70px}
  button.submit{margin-top:14px;width:100%;background:var(--navy);color:#fff;border:0;border-radius:10px;
    padding:13px;font-size:15px;font-weight:600;cursor:pointer}
  button.submit:disabled{opacity:.5;cursor:not-allowed}
  .thanks{text-align:center;padding:10px 0}
  .thanks .big{font-size:44px;margin-bottom:8px}
  .thanks h2{margin:0 0 6px;color:var(--navy)}
  .err{color:#b42318;font-size:13px;margin-top:10px;text-align:center;display:none}
  .foot{margin-top:16px;text-align:center;font-size:11px;color:var(--muted)}
</style></head>
<body>
<div class="card" id="card">
  <div class="brand">UB FREIGHT</div>
  <h1>How did we do?</h1>
  <p class="sub">Tap a face, then submit. Your feedback goes straight to our team.</p>
  <div class="faces" id="faces">
    <button class="face" data-s="1">\u{1F61E}</button>
    <button class="face" data-s="2">\u{1F610}</button>
    <button class="face" data-s="3">\u{1F642}</button>
    <button class="face" data-s="4">\u{1F600}</button>
    <button class="face" data-s="5">\u{1F929}</button>
  </div>
  <div class="scale"><span>Poor</span><span>Excellent</span></div>
  <textarea id="comment" placeholder="Anything you'd like to add? (optional)"></textarea>
  <button class="submit" id="submit" disabled>Submit rating</button>
  <div class="err" id="err">Something went wrong — please try again.</div>
  <div class="foot">UB Freight · Auckland, New Zealand</div>
</div>
<script>
  const CFG = ${cfg};
  let sel = CFG.score >= 1 && CFG.score <= 5 ? CFG.score : 0;
  const faces = [...document.querySelectorAll('.face')];
  const submit = document.getElementById('submit');
  const errEl = document.getElementById('err');
  function paint(){ faces.forEach(f => f.classList.toggle('sel', Number(f.dataset.s) === sel)); submit.disabled = sel < 1; }
  faces.forEach(f => f.addEventListener('click', () => { sel = Number(f.dataset.s); paint(); }));
  paint();
  submit.addEventListener('click', async () => {
    submit.disabled = true; submit.textContent = 'Submitting\u2026'; errEl.style.display='none';
    try {
      const res = await fetch(window.location.pathname + window.location.search, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ score: sel, rep: CFG.rep, ref: CFG.ref, channel: CFG.channel,
          comment: document.getElementById('comment').value })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error('fail');
      const emoji = ['','\u{1F61E}','\u{1F610}','\u{1F642}','\u{1F600}','\u{1F929}'][sel];
      document.getElementById('card').innerHTML =
        '<div class="thanks"><div class="big">'+emoji+'</div><h2>Thank you!</h2>'+
        '<p class="sub">Your feedback has been recorded.</p></div>';
    } catch(e){
      errEl.style.display='block'; submit.disabled=false; submit.textContent='Submit rating';
    }
  });
</script>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const rep = esc(url.searchParams.get("rep") ?? "");
    const ref = esc(url.searchParams.get("ref") ?? "");
    const channel = esc(url.searchParams.get("c") ?? "email_signature");
    const score = clampScore(url.searchParams.get("score"));
    const headers = new Headers();
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Cache-Control", "no-store");
    return new Response(page(rep, score, ref, channel), { status: 200, headers });
  }

  if (req.method === "POST") {
    let b: { score?: number; rep?: string; ref?: string; channel?: string; comment?: string };
    try { b = await req.json(); } catch { return new Response(JSON.stringify({ ok:false, error:"bad_json" }), { status:400, headers:{"content-type":"application/json"} }); }
    const score = Number(b.score);
    if (!(score >= 1 && score <= 5)) return new Response(JSON.stringify({ ok:false, error:"bad_score" }), { status:400, headers:{"content-type":"application/json"} });
    const rep = b.rep ? String(b.rep) : null;
    const isEmail = !!rep && rep.includes("@");
    const sb = db();
    const { data, error } = await sb.rpc("csat_submit", {
      p_score: score,
      p_channel: (b.channel && String(b.channel)) || "email_signature",
      p_comment: b.comment ? String(b.comment).slice(0, 2000) : null,
      p_staff_initials: isEmail ? null : rep,
      p_staff_email: isEmail ? rep : null,
      p_booking_ref: b.ref ? String(b.ref) : null,
    });
    if (error) return new Response(JSON.stringify({ ok:false, error:"rpc_failed", detail:error.message }), { status:500, headers:{"content-type":"application/json"} });
    return new Response(JSON.stringify(data ?? { ok:true }), { status:200, headers:{"content-type":"application/json"} });
  }

  return new Response("method not allowed", { status: 405 });
});
