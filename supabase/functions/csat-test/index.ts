import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve((_req: Request) => {
  const html = "<!doctype html><html><head><meta charset=\"utf-8\"><title>Test</title></head>" +
    "<body style=\"font-family:sans-serif;text-align:center;padding:40px\">" +
    "<h1 style=\"color:#0A2472\">If you can read this as a heading, HTML rendering works.</h1>" +
    "<p>Plain text would show the tags instead.</p></body></html>";
  const headers = new Headers();
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(html, { status: 200, headers });
});
