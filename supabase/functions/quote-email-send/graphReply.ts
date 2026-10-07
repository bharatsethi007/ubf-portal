// Reply-all in an existing Graph thread with our own HTML on top, custom recipients and attachments.
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { apiFetch } from "../_shared/apiFetch.ts";
import { GRAPH } from "../email-inbox-sync/graph.ts";
import type { OutAttachment } from "../booking-email-send/graphSend.ts";

const H = (t: string) => ({ Authorization: `Bearer ${t}`, "Content-Type": "application/json", Prefer: 'IdType="ImmutableId"' });
const rcpt = (list: string[]) => list.map((address) => ({ emailAddress: { address } }));

async function must(r: Response, what: string): Promise<Response> {
  if (!r.ok) throw new Error(`Graph ${what} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r;
}

export type ReplyDraft = { id: string; internetMessageId?: string; conversationId?: string; subject?: string };

export async function replyAllHtml(
  token: string, mailbox: string, msgId: string, html: string, to: string[], cc: string[], attachments: OutAttachment[],
): Promise<ReplyDraft> {
  const base = `${GRAPH}/users/${encodeURIComponent(mailbox)}/messages`;
  const c = await must(await apiFetch(`${base}/${msgId}/createReplyAll`, { method: "POST", headers: H(token), body: "{}" }), "createReplyAll");
  type R = { emailAddress?: { address?: string } };
  const draft = await c.json() as ReplyDraft & { body?: { content?: string }; toRecipients?: R[]; ccRecipients?: R[] };
  // Reply-all keeps everyone already on the thread; staff can add more. Never send to our own mailbox.
  const own = mailbox.toLowerCase();
  const list = (r?: R[]) => (r ?? []).map((x) => (x.emailAddress?.address ?? "").toLowerCase()).filter(Boolean);
  const allTo = [...new Set([...list(draft.toRecipients), ...to])].filter((e) => e !== own);
  const allCc = [...new Set([...list(draft.ccRecipients), ...cc])].filter((e) => e !== own && !allTo.includes(e));
  const url = `${base}/${draft.id}`;
  try {
    const quoted = draft.body?.content ?? "";
    // Our message goes above the quoted thread, inside <body> when Graph returns a full document.
    const content = /<body[^>]*>/i.test(quoted)
      ? quoted.replace(/<body([^>]*)>/i, `<body$1>${html}<br>`)
      : `${html}<br>${quoted}`;
    await must(await apiFetch(url, {
      method: "PATCH", headers: H(token),
      body: JSON.stringify({ body: { contentType: "HTML", content }, toRecipients: rcpt(allTo), ccRecipients: rcpt(allCc) }),
    }), "update draft");
    for (const a of attachments) {
      await must(await apiFetch(`${url}/attachments`, {
        method: "POST", headers: H(token),
        body: JSON.stringify({ "@odata.type": "#microsoft.graph.fileAttachment", name: a.name, contentType: a.contentType, contentBytes: encodeBase64(a.bytes) }),
      }), "attach");
    }
    await must(await apiFetch(`${url}/send`, { method: "POST", headers: H(token) }), "send");
  } catch (e) {
    await apiFetch(url, { method: "DELETE", headers: H(token) }).catch(() => null);
    throw e;
  }
  return draft;
}
