// Microsoft Graph helpers for shared-mailbox inbox sync. App-only token (same Azure app as booking-email-ingest).
import { apiFetch } from "../_shared/apiFetch.ts";

export const GRAPH = "https://graph.microsoft.com/v1.0";

export type Addr = { emailAddress?: { name?: string; address?: string } };
export type GMsg = {
  id: string; internetMessageId?: string; conversationId?: string; subject?: string;
  from?: Addr; toRecipients?: Addr[]; ccRecipients?: Addr[];
  receivedDateTime?: string; sentDateTime?: string; hasAttachments?: boolean; isDraft?: boolean;
  uniqueBody?: { content?: string }; body?: { content?: string }; webLink?: string;
};
export type GAtt = { id: string; name?: string; contentType?: string; size?: number; isInline?: boolean; contentBytes?: string; "@odata.type"?: string };

export async function graphToken(): Promise<string> {
  const tenant = Deno.env.get("MS_TENANT_ID"), id = Deno.env.get("MS_CLIENT_ID"), secret = Deno.env.get("MS_CLIENT_SECRET");
  if (!tenant || !id || !secret) throw new Error("Missing MS Graph env vars");
  const res = await apiFetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`Graph token failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token as string;
}

/** App permissions granted to this token (from the JWT roles claim). */
export function tokenRoles(token: string): string[] {
  try {
    const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return (JSON.parse(atob(p + "=".repeat((4 - (p.length % 4)) % 4))).roles ?? []) as string[];
  } catch { return []; }
}

// ImmutableId: message ids survive folder moves, so replies still find the original later.
const H = (t: string, extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${t}`, "Content-Type": "application/json", Prefer: 'IdType="ImmutableId"', ...extra });
const SELECT = "id,internetMessageId,conversationId,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,hasAttachments,isDraft,uniqueBody,body,webLink";

/** All folders (Inbox, Sent, subfolders) so mail moved quickly is not missed. Oldest first. */
export async function listSince(token: string, mailbox: string, since: string, top = 25): Promise<GMsg[]> {
  const filter = encodeURIComponent(`receivedDateTime ge ${since} and isDraft eq false`);
  const url = `${GRAPH}/users/${encodeURIComponent(mailbox)}/messages?$filter=${filter}&$orderby=receivedDateTime asc&$top=${top}&$select=${SELECT}`;
  const res = await apiFetch(url, { headers: H(token, { Prefer: 'outlook.body-content-type="text", IdType="ImmutableId"' }) });
  if (!res.ok) throw new Error(`Graph list ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()).value ?? []) as GMsg[];
}

export async function listAttachments(token: string, mailbox: string, msgId: string): Promise<GAtt[]> {
  const url = `${GRAPH}/users/${encodeURIComponent(mailbox)}/messages/${msgId}/attachments?$select=id,name,contentType,size,isInline`;
  const res = await apiFetch(url, { headers: H(token) });
  if (!res.ok) return [];
  return ((await res.json()).value ?? []) as GAtt[];
}

export async function attachmentBytes(token: string, mailbox: string, msgId: string, attId: string): Promise<Uint8Array | null> {
  const url = `${GRAPH}/users/${encodeURIComponent(mailbox)}/messages/${msgId}/attachments/${attId}/$value`;
  const res = await apiFetch(url, { headers: { Authorization: `Bearer ${token}`, Prefer: 'IdType="ImmutableId"' } });
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

/** Reply-all with text above the quoted thread (createReplyAll + send). Returns the draft as created. */
export async function replyAll(token: string, mailbox: string, msgId: string, text: string): Promise<GMsg> {
  const base = `${GRAPH}/users/${encodeURIComponent(mailbox)}/messages`;
  const c = await apiFetch(`${base}/${msgId}/createReplyAll`, { method: "POST", headers: H(token), body: JSON.stringify({ comment: text }) });
  if (!c.ok) throw new Error(`Graph createReplyAll ${c.status}: ${(await c.text()).slice(0, 300)}`);
  const draft = await c.json() as GMsg;
  const s = await apiFetch(`${base}/${draft.id}/send`, { method: "POST", headers: H(token) });
  if (!s.ok) throw new Error(`Graph send ${s.status}: ${(await s.text()).slice(0, 300)}`);
  return draft;
}

export const addr = (a?: Addr) => ({ name: a?.emailAddress?.name ?? null, address: (a?.emailAddress?.address ?? "").toLowerCase() || null });
