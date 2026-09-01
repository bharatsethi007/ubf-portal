// meeting-transcribe — signed audio URL -> Deepgram Nova-3 (diarized) -> Claude summary
// -> append summary to the meeting's Discussion field + store transcript/ai_summary.
// Invoked from the browser via supabase.functions.invoke (verify_jwt = true).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const BUCKET = "meeting-audio";

type NoteField = { id: string; label: string; value: string };

function flatten(fields: NoteField[]): string {
  return fields
    .map((f) => ({ label: (f.label ?? "").trim(), value: (f.value ?? "").trim() }))
    .filter((f) => f.value)
    .map((f) => (f.label ? `${f.label}: ${f.value}` : f.value))
    .join("\n");
}

function appendSummaryToDiscussion(fields: NoteField[], summary: string): NoteField[] {
  const next = Array.isArray(fields) ? [...fields] : [];
  const idx = next.findIndex((f) => (f?.label ?? "").trim().toLowerCase() === "discussion");
  const block = summary.trim();
  if (idx >= 0) {
    const existing = (next[idx].value ?? "").trim();
    next[idx] = { ...next[idx], value: existing ? `${existing}\n\n${block}` : block };
  } else {
    next.push({ id: crypto.randomUUID(), label: "Discussion", value: block });
  }
  return next;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  let meetingId = "";
  try {
    const body = await req.json().catch(() => ({}));
    meetingId = body.meeting_id ?? "";
    const audioPath: string = body.audio_path ?? "";
    if (!meetingId || !audioPath) throw new Error("meeting_id and audio_path required");
    if (!DEEPGRAM_API_KEY) throw new Error("DEEPGRAM_API_KEY not set");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

    await db.from("conference_meetings").update({ transcribe_status: "processing" }).eq("id", meetingId);

    // 1. signed URL for the uploaded audio
    const { data: signed, error: signErr } = await db.storage.from(BUCKET).createSignedUrl(audioPath, 600);
    if (signErr || !signed?.signedUrl) throw new Error(`sign audio: ${signErr?.message ?? "no url"}`);

    // 2. Deepgram transcribe + diarize
    const dgRes = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-3&diarize=true&punctuate=true&smart_format=true&utterances=true&mip_opt_out=true",
      {
        method: "POST",
        headers: { Authorization: `Token ${DEEPGRAM_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: signed.signedUrl }),
      },
    );
    if (!dgRes.ok) throw new Error(`deepgram ${dgRes.status}: ${await dgRes.text()}`);
    const dg = await dgRes.json();
    const utterances = dg.results?.utterances ?? [];
    const transcript: string = utterances.length
      ? utterances
        .map((u: { speaker: number; transcript: string }) => `Speaker ${u.speaker}: ${u.transcript}`)
        .join("\n")
      : (dg.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "");
    if (!transcript.trim()) throw new Error("empty transcript");

    // 3. Claude summary
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        messages: [{
          role: "user",
          content:
            "You are summarising a short in-person meeting between a freight-forwarding company (UB Freight) " +
            "and an overseas agent at an industry conference. Write a concise, plain-text summary (no markdown, " +
            "no headings) covering what was discussed, any commitments made, and follow-up actions. Keep it tight.\n\n" +
            "Transcript:\n" + transcript,
        }],
      }),
    });
    if (!claudeRes.ok) throw new Error(`claude ${claudeRes.status}: ${await claudeRes.text()}`);
    const claude = await claudeRes.json();
    const summary: string = (claude.content?.[0]?.text ?? "").trim();
    if (!summary) throw new Error("empty summary");

    // 4. append summary to the Discussion field, recompute flattened notes
    const { data: row } = await db
      .from("conference_meetings").select("notes_fields").eq("id", meetingId).maybeSingle();
    const fields = appendSummaryToDiscussion((row?.notes_fields ?? []) as NoteField[], summary);
    const notesText = flatten(fields);

    const { error: upErr } = await db.from("conference_meetings").update({
      notes_fields: fields,
      notes: notesText || null,
      transcript,
      ai_summary: summary,
      transcribe_status: "done",
      updated_at: new Date().toISOString(),
    }).eq("id", meetingId);
    if (upErr) throw new Error(`save notes: ${upErr.message}`);

    // 5. delete audio (best effort)
    await db.storage.from(BUCKET).remove([audioPath]);

    return json({ ok: true, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (meetingId) {
      await db.from("conference_meetings").update({ transcribe_status: "error" }).eq("id", meetingId);
    }
    return json({ ok: false, error: msg }, 500);
  }
});
