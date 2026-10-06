// Unified inbox data layer. All reads/writes go through inbox_* RPCs (is_staff gated).
// WhatsApp replies go through the whatsapp-reply edge fn; the DB trigger mirrors them into the inbox.
import { supabase } from '../../supabase'

export type Channel = 'portal' | 'whatsapp' | 'wechat' | 'email' | 'internal'
export type View = 'mine' | 'unassigned' | 'unknown' | 'all' | 'snoozed' | 'closed' | 'ignored'
export type ContactType = 'customer' | 'lead' | 'carrier' | 'shipper' | 'agent' | 'spam'

export type InboxCounts = {
  mine: number; unassigned: number; unknown: number; all: number; snoozed: number; overdue: number; awaiting: number
  channels: Partial<Record<Channel, number>>; teams: Record<string, number>
}

export type InboxRow = {
  id: string; subject: string | null; who: string; account_id: string | null; account_name: string | null
  team: string | null; assignee_id: string | null; assignee_name: string | null
  last_message_at: string; last_preview: string | null; last_channel: Channel | null; last_sender: string | null
  reply_due_at: string | null; wa_id: string | null; contact_type: ContactType | null; booking_ref: string | null
  contact_email: string | null
  unread: number; channels: Channel[]
}

export type InboxMessage = {
  id: number; channel: Channel; kind: 'message' | 'note' | 'event'; direction: 'in' | 'out' | null
  sender_kind: 'customer' | 'contact' | 'staff' | 'system'; sender_name: string | null; body: string | null
  msg_type: string | null; media_path: string | null; status: string | null; created_at: string
  email: EmailMeta | null
}

export type EmailAttachment = { id: number; name: string; size: number | null; s3_key: string; content_type: string | null }
export type EmailMeta = {
  subject: string | null; from: string | null; web_link: string | null
  to: { name: string | null; address: string | null }[]; cc: { name: string | null; address: string | null }[]
  attachments: EmailAttachment[]
}

export type InboxShipment = {
  id: string; booking_ref: string | null; origin: string | null; destination: string | null; stage: string | null
  next_action: string | null; action_due: string | null; urgency: string | null; last_free_day: string | null
  eta: string | null; focus: boolean
}

export type InboxDetail = {
  conversation: {
    id: string; account_id: string | null; wa_contact_id: string | null; portal_thread_id: string | null
    booking_id: string | null; subject: string | null; team: string | null; assignee_id: string | null
    assignee_name: string | null; eff_status: 'open' | 'snoozed' | 'closed' | 'ignored'; snoozed_until: string | null
    reply_due_at: string | null; first_reply_at: string | null; created_at: string; booking_ref: string | null
    contact_linked: boolean; contact_type: ContactType | null; contact_email: string | null; contact_name: string | null
  }
  account: { account_id: string; name: string; portal_users: number } | null
  contact: {
    id: string; wa_id: string; display_name: string | null; contact_type: ContactType | null; company: string | null
    verified: boolean; opted_in: boolean; last_inbound_at: string | null; window_ends_at: string | null
  } | null
  email: { mailbox: string; contact_email: string | null; contact_name: string | null } | null
  messages: InboxMessage[]
  shipments: InboxShipment[]
}

export const contactTypeOf = (d: InboxDetail): ContactType | null => d.contact?.contact_type ?? d.conversation.contact_type ?? null
export const isUnknown = (d: InboxDetail) => !d.account && !contactTypeOf(d)

export type StaffOption = { user_id: string; name: string; initials: string | null }

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const fetchCounts = () => rpc<InboxCounts>('inbox_counts')
export const fetchList = (view: View, channel: Channel | null, team: string | null, search: string) =>
  rpc<InboxRow[]>('inbox_list', { p_view: view, p_channel: channel, p_team: team, p_search: search || null })
export const fetchDetail = (id: string) => rpc<InboxDetail>('inbox_get', { p_id: id })
export const markRead = (id: string) => rpc<void>('inbox_mark_read', { p_id: id })
export const addNote = (id: string, body: string) => rpc<void>('inbox_note', { p_id: id, p_body: body })
export const assign = (id: string, userId: string | null) => rpc<void>('inbox_assign', { p_id: id, p_user: userId })
export const setStatus = (id: string, status: 'open' | 'snoozed' | 'closed', until?: string) =>
  rpc<void>('inbox_set_status', { p_id: id, p_status: status, p_until: until ?? null })
export const replyPortal = (id: string, body: string) => rpc<void>('inbox_reply_portal', { p_id: id, p_body: body })
export const linkContact = (id: string, type: ContactType, accountId?: string | null) =>
  rpc<void>('inbox_link_contact', { p_id: id, p_type: type, p_account: accountId ?? null })
export const fetchStaff = () => rpc<StaffOption[]>('inbox_staff_list')
export const bulk = (ids: string[], action: 'close' | 'ignore' | 'assign_me' | 'open') => rpc<number>('inbox_bulk', { p_ids: ids, p_action: action })
export const linkDomain = (id: string, type: ContactType, accountId?: string | null) =>
  rpc<{ domain: string; updated: number }>('inbox_link_domain', { p_id: id, p_type: type, p_account: accountId ?? null })
export const ignore = (id: string, sender = false) => rpc<{ blocked: string | null }>('inbox_ignore', { p_id: id, p_sender: sender })

export type JobHit = {
  id: string; booking_ref: string; job_no: string | null; module: string; status: string; customer: string | null
  customer_ref: string | null; mbl_no: string | null; hawb: string | null; eta: string | null; etd: string | null
  containers: string | null; linked: boolean
}
export const searchJobs = (convId: string, q: string) => rpc<JobHit[]>('inbox_job_search', { p_conv: convId, p_q: q || null })
export const linkJob = (convId: string, bookingId: string | null) => rpc<void>('inbox_link_job', { p_id: convId, p_booking: bookingId })

export async function fetchDocTags(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from('document_tags').select('id,name').order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as { id: string; name: string }[]
}

export type JobChange = { field: string; label: string; current: string | number | null; proposed: string | number; unsure: boolean }
export type JobProposal = { booking_ref: string; changes: JobChange[]; containers: { no: string; type: string | null }[] }

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    let msg = error.message
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try { const j = await ctx.json(); msg = j?.error ?? msg } catch { /* keep default */ }
    }
    throw new Error(msg)
  }
  const r = (data ?? {}) as T & { error?: string }
  if (r.error) throw new Error(r.error)
  return r
}

export const saveDocsToJob = (convId: string, bookingId: string, attachmentIds: number[], tagId: string | null) =>
  invoke<{ saved: number; skipped: number; booking_ref: string }>('inbox-job',
    { action: 'attach', conversation_id: convId, booking_id: bookingId, attachment_ids: attachmentIds, tag_id: tagId })
export const proposeJobUpdate = (convId: string, bookingId: string, messageId: number | null) =>
  invoke<JobProposal>('inbox-job', { action: 'propose', conversation_id: convId, booking_id: bookingId, message_id: messageId })
export const applyJobUpdate = (convId: string, bookingId: string, changes: Record<string, unknown>, containers: { no: string; type: string | null }[]) =>
  invoke<{ booking_ref: string; updated: string[] }>('inbox-job', { action: 'apply', conversation_id: convId, booking_id: bookingId, changes, containers })

export async function replyWhatsApp(conversationId: string, contactId: string, text: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('whatsapp-reply', {
    body: { contact_id: contactId, text, conversation_id: conversationId },
  })
  if (error) {
    let msg = error.message
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try { const j = await ctx.json(); msg = j?.message ?? j?.error ?? msg } catch { /* keep default */ }
    }
    throw new Error(msg)
  }
  const payload = (data ?? {}) as { error?: string; message?: string }
  if (payload.error) throw new Error(payload.message ?? payload.error)
}

export async function replyEmail(conversationId: string, text: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('email-reply', { body: { conversation_id: conversationId, text } })
  if (error) {
    let msg = error.message
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try { const j = await ctx.json(); msg = j?.error ?? msg } catch { /* keep default */ }
    }
    throw new Error(msg)
  }
  const payload = (data ?? {}) as { error?: string }
  if (payload.error) throw new Error(payload.error)
}

export type CreatedBooking = { id: string; booking_ref: string; module: string; containers: number; documents: number; low_confidence: string[] }

export async function createBookingFromConversation(conversationId: string, module: string, mode: 'quick' | 'ai'): Promise<CreatedBooking> {
  const { data, error } = await supabase.functions.invoke('inbox-booking', { body: { conversation_id: conversationId, module, mode } })
  if (error) {
    let msg = error.message
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try { const j = await ctx.json(); msg = j?.error ?? msg } catch { /* keep default */ }
    }
    throw new Error(msg)
  }
  const r = (data ?? {}) as CreatedBooking & { error?: string }
  if (r.error) throw new Error(r.error)
  return r
}

export async function searchAccounts(q: string): Promise<{ account_id: string; name: string }[]> {
  if (q.trim().length < 2) return []
  const { data, error } = await supabase.from('customers').select('account_id,name')
    .eq('closed', false).ilike('name', `%${q.trim()}%`).order('name').limit(8)
  if (error) throw new Error(error.message)
  return (data ?? []) as { account_id: string; name: string }[]
}
