import type { GraphAttachment, GraphMessage } from "./types.ts";
import { MAILBOX } from "./types.ts";

const GRAPH = "https://graph.microsoft.com/v1.0";

export async function getGraphToken(): Promise<string> {
  const tenant = Deno.env.get("MS_TENANT_ID");
  const clientId = Deno.env.get("MS_CLIENT_ID");
  const secret = Deno.env.get("MS_CLIENT_SECRET");
  if (!tenant || !clientId || !secret) throw new Error("Missing MS Graph env vars");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: secret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Graph token failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (!json.access_token) throw new Error("Graph token response missing access_token");
  return json.access_token as string;
}

function graphHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function fetchUnreadMessages(token: string, top = 10): Promise<GraphMessage[]> {
  const filter = encodeURIComponent("isRead eq false");
  const url =
    `${GRAPH}/users/${encodeURIComponent(MAILBOX)}/messages` +
    `?$filter=${filter}&$top=${top}&$expand=attachments&$select=id,subject,receivedDateTime,from,body,attachments`;

  const res = await fetch(url, { headers: graphHeaders(token) });
  if (!res.ok) throw new Error(`Graph messages failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return (json.value ?? []) as GraphMessage[];
}

export async function markMessageRead(token: string, messageId: string): Promise<void> {
  const url = `${GRAPH}/users/${encodeURIComponent(MAILBOX)}/messages/${messageId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: graphHeaders(token),
    body: JSON.stringify({ isRead: true }),
  });
  if (!res.ok) throw new Error(`Graph mark read failed: ${res.status} ${await res.text()}`);
}

export async function downloadAttachmentBytes(
  token: string,
  messageId: string,
  att: GraphAttachment,
): Promise<Uint8Array | null> {
  if (att.contentBytes) {
    const bin = atob(att.contentBytes);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  const url =
    `${GRAPH}/users/${encodeURIComponent(MAILBOX)}/messages/${messageId}` +
    `/attachments/${att.id}/$value`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

export function senderAddress(msg: GraphMessage): string | null {
  return msg.from?.emailAddress?.address?.trim() || null;
}
