// Graph send-as-mailbox with attachments. Small files inline (<3 MB), larger via upload session.
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { apiFetch } from "../_shared/apiFetch.ts";
import { GRAPH } from "../email-inbox-sync/graph.ts";

export type OutAttachment = { name: string; contentType: string; bytes: Uint8Array };
export type OutMail = { subject: string; html: string; to: string[]; cc: string[]; attachments: OutAttachment[] };

const INLINE_MAX = 3 * 1024 * 1024;
const CHUNK = 320 * 1024 * 12; // 3.75 MB, multiple of 320 KiB as Graph requires

const H = (t: string) => ({ Authorization: `Bearer ${t}`, "Content-Type": "application/json" });
const rcpt = (list: string[]) => list.map((address) => ({ emailAddress: { address } }));

async function must(r: Response, what: string): Promise<Response> {
  if (!r.ok) throw new Error(`Graph ${what} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r;
}

async function uploadLarge(token: string, base: string, a: OutAttachment): Promise<void> {
  const s = await must(await apiFetch(`${base}/attachments/createUploadSession`, {
    method: "POST", headers: H(token),
    body: JSON.stringify({ AttachmentItem: { attachmentType: "file", name: a.name, size: a.bytes.length, contentType: a.contentType } }),
  }), "upload session");
  const { uploadUrl } = await s.json() as { uploadUrl: string };
  for (let start = 0; start < a.bytes.length; start += CHUNK) {
    const end = Math.min(start + CHUNK, a.bytes.length);
    // uploadUrl is pre-authorised: no bearer header allowed.
    await must(await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream", "Content-Range": `bytes ${start}-${end - 1}/${a.bytes.length}` },
      body: a.bytes.slice(start, end),
    }), "upload chunk");
  }
}

/** Creates a draft in the mailbox, adds attachments, sends. Lands in the mailbox's Sent Items. */
export async function sendAsMailbox(token: string, mailbox: string, m: OutMail): Promise<{ id: string; internetMessageId?: string }> {
  const users = `${GRAPH}/users/${encodeURIComponent(mailbox)}/messages`;
  const d = await must(await apiFetch(users, {
    method: "POST", headers: H(token),
    body: JSON.stringify({
      subject: m.subject, body: { contentType: "HTML", content: m.html },
      toRecipients: rcpt(m.to), ccRecipients: rcpt(m.cc),
    }),
  }), "create draft");
  const draft = await d.json() as { id: string; internetMessageId?: string };
  const base = `${users}/${draft.id}`;
  try {
    for (const a of m.attachments) {
      if (a.bytes.length < INLINE_MAX) {
        await must(await apiFetch(`${base}/attachments`, {
          method: "POST", headers: H(token),
          body: JSON.stringify({ "@odata.type": "#microsoft.graph.fileAttachment", name: a.name, contentType: a.contentType, contentBytes: encodeBase64(a.bytes) }),
        }), "attach");
      } else {
        await uploadLarge(token, base, a);
      }
    }
    await must(await apiFetch(`${base}/send`, { method: "POST", headers: H(token) }), "send");
  } catch (e) {
    // Do not leave half-built drafts in the shared mailbox.
    await apiFetch(base, { method: "DELETE", headers: H(token) }).catch(() => null);
    throw e;
  }
  return draft;
}
