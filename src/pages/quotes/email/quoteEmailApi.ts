import { supabase } from '../../../supabase'

export type EmailThread = {
  id: string; subject: string | null; mailbox: string; contact_email: string | null; contact_name: string | null
  last_message_at: string; last_preview: string | null; messages: number; match: string; suggested: boolean
}

export type QuoteEmailFacts = {
  quoteNo: string; lane: string; isLcl: boolean; contactName: string | null; contactEmail: string | null
  expiresAt: string | null; ownerName: string | null
  options: { carrier: string | null; total: number | null; currency: string | null; transit: number | null }[]
}

export async function fetchThreads(quoteId: string, search: string): Promise<EmailThread[]> {
  const { data, error } = await supabase.rpc('quote_email_threads', { p_quote: quoteId, p_search: search.trim() || null })
  if (error) throw error
  return (data as EmailThread[]) ?? []
}

export async function fetchEmailFacts(quoteId: string, portName: (c: string | null) => string): Promise<QuoteEmailFacts> {
  const { data: q, error } = await supabase.from('quotes')
    .select('quote_no, shipment_type, from_port_code, to_port_code, contact_name, expires_at, created_by').eq('id', quoteId).single()
  if (error) throw error
  const [{ data: email }, { data: opts }, { data: owner }] = await Promise.all([
    supabase.rpc('quote_contact_email', { p_quote: quoteId }),
    supabase.from('quote_responses').select('carrier, total_sell, currency, transit_time_days, status')
      .eq('quote_id', quoteId).gt('total_sell', 0).not('status', 'in', '(rejected,withdrawn)').order('total_sell'),
    q.created_by ? supabase.from('staff_users').select('full_name').eq('user_id', q.created_by).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const isLcl = String(q.shipment_type ?? '').toUpperCase() === 'LCL'
  return {
    quoteNo: q.quote_no ?? '', lane: `${portName(q.from_port_code)} to ${portName(q.to_port_code)}`, isLcl,
    contactName: q.contact_name, contactEmail: (email as string | null) ?? null, expiresAt: q.expires_at,
    ownerName: (owner as { full_name?: string } | null)?.full_name ?? null,
    options: (opts ?? []).map((o) => ({ carrier: isLcl ? null : o.carrier, total: o.total_sell, currency: o.currency, transit: o.transit_time_days })),
  }
}

export function defaultMessage(f: QuoteEmailFacts, myName: string | null): string {
  const first = f.contactName?.trim().split(/\s+/)[0]
  const money = (n: number | null, c: string | null) => (n == null ? '' : `${c ?? 'NZD'} ${Number(n).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  const lines = f.options.map((o, i) => `- ${o.carrier ?? (f.options.length > 1 ? `Option ${i + 1}` : 'Rate')}: ${money(o.total, o.currency)}${o.transit ? `, ${o.transit} days transit` : ''}`)
  const valid = f.expiresAt ? `\n\nThis quote is valid until ${new Date(f.expiresAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}.` : ''
  return [
    `Hi ${first ?? 'there'},`,
    `Please find attached our quote ${f.quoteNo} for ${f.lane}.${lines.length ? `\n\n${lines.join('\n')}` : ''}${valid}`,
    'Let me know if you would like to go ahead or if anything needs changing.',
    `Kind regards,\n${myName ?? f.ownerName ?? 'UB Freight Sales Support'}\nUB Freight Ltd`,
  ].join('\n\n')
}

export async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}

export async function sendQuoteEmail(body: {
  quote_id: string; conversation_id: string | null; to: string[]; cc: string[]; subject: string; text: string
  pdf_base64: string | null; pdf_name: string | null; include_actions: boolean
}): Promise<{ from: string; mode: string }> {
  const { data, error } = await supabase.functions.invoke('quote-email-send', { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const detail = ctx ? await ctx.json().catch(() => null) : null
    throw new Error(detail?.error ?? error.message)
  }
  return data as { from: string; mode: string }
}

export const splitEmails = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean)
