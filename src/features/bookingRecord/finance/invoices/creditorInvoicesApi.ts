import { supabase } from '@/supabase'
import { uploadBookingFile, signedDownloadUrl } from '@/components/bookings/bookingDocumentsApi'
import { sendBookingEmail } from '@/features/bookingRecord/email/emailApi'

export type CheckResult = {
  verdict: 'ok' | 'over' | 'under' | 'no_expected' | 'duplicate' | 'check_ref' | 'unread'
  basis: string | null
  invoice: number | null
  expected: number | null
  diff: number | null
  tolerance: number | null
  reasons: string[]
  checked_at: string
}

export type CreditorInvoice = {
  id: string
  booking_id: string
  document_id: string | null
  stamped_document_id: string | null
  vendor_name: string | null
  cost_type: string | null
  invoice_no: string | null
  invoice_date: string | null
  due_date: string | null
  currency: string
  subtotal: number | null
  tax: number | null
  total: number | null
  fx_rate: number
  total_nzd: number
  references_found: string[] | null
  ai_status: 'pending' | 'reading' | 'read' | 'failed' | 'manual'
  ai_error: string | null
  check_result: CheckResult | null
  status: 'received' | 'approved' | 'disputed'
  pay_by: string | null
  urgent: boolean
  approval_comment: string | null
  approved_by_name: string | null
  approved_at: string | null
  dispute_reason: string | null
  disputed_at: string | null
  sent_at: string | null
  needs_restamp: boolean
  version: number
  created_at: string
}

export type InvoiceEvent = { id: number; action: string; detail: Record<string, unknown> | null; actor_name: string | null; created_at: string }

export type BookingMeta = { booking_ref: string | null; account_id: string; eta: string | null; module: string | null; customer_name: string | null }

export type InvoiceDoc = { id: string; file_name: string; storage_path: string; mime_type: string | null; tag_id: string | null }

const COLS = 'id, booking_id, document_id, stamped_document_id, vendor_name, cost_type, invoice_no, invoice_date, due_date, currency, subtotal, tax, total, fx_rate, total_nzd, references_found, ai_status, ai_error, check_result, status, pay_by, urgent, approval_comment, approved_by_name, approved_at, dispute_reason, disputed_at, sent_at, needs_restamp, version, created_at'

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message) }

export const ACCOUNTS_EMAIL = 'accounts.nz@ubfreight.com'

export async function listInvoices(bookingId: string): Promise<CreditorInvoice[]> {
  const { data, error } = await supabase.from('creditor_invoices').select(COLS).eq('booking_id', bookingId).order('created_at')
  fail(error)
  return (data ?? []) as unknown as CreditorInvoice[]
}

export async function fetchBookingMeta(bookingId: string): Promise<BookingMeta> {
  const { data, error } = await supabase.from('bookings')
    .select('booking_ref, account_id, m_eta, eta, module, importer_name, shipment_id, customers!bookings_account_id_fkey ( name )')
    .eq('id', bookingId).single()
  fail(error)
  const b = data as unknown as {
    booking_ref: string | null; account_id: string; m_eta: string | null; eta: string | null; module: string | null
    importer_name: string | null; shipment_id: number | null; customers: { name: string | null } | { name: string | null }[] | null
  }
  const cust = Array.isArray(b.customers) ? b.customers[0] : b.customers
  // ETA: manual/job ETA first, then the matched ERP shipment.
  let eta = b.m_eta ?? b.eta ?? null
  if (!eta && b.shipment_id) {
    const { data: sh } = await supabase.from('shipments').select('eta').eq('job_unique', b.shipment_id).maybeSingle()
    eta = (sh?.eta as string | null | undefined)?.slice(0, 10) ?? null
  }
  return { booking_ref: b.booking_ref, account_id: b.account_id, eta, module: b.module, customer_name: cust?.name ?? b.importer_name ?? null }
}

async function tagId(name: string): Promise<string | null> {
  const { data } = await supabase.from('document_tags').select('id').eq('name', name).maybeSingle()
  return (data?.id as string | undefined) ?? null
}

async function uid(): Promise<string | null> {
  return (await supabase.auth.getUser()).data.user?.id ?? null
}

export async function listInvoiceCandidateDocs(bookingId: string): Promise<InvoiceDoc[]> {
  const [{ data: docs, error }, { data: used }] = await Promise.all([
    supabase.from('booking_documents').select('id, file_name, storage_path, mime_type, tag_id').eq('booking_id', bookingId).order('created_at', { ascending: false }),
    supabase.from('creditor_invoices').select('document_id, stamped_document_id').eq('booking_id', bookingId),
  ])
  fail(error)
  const taken = new Set((used ?? []).flatMap((u) => [u.document_id, u.stamped_document_id]).filter(Boolean))
  return ((docs ?? []) as InvoiceDoc[]).filter((d) => !taken.has(d.id)
    && (/pdf|image\//i.test(d.mime_type ?? '') || /\.(pdf|png|jpe?g)$/i.test(d.file_name)))
}

export async function createFromDocument(bookingId: string, documentId: string): Promise<string> {
  const { data, error } = await supabase.from('creditor_invoices').insert({ booking_id: bookingId, document_id: documentId }).select('id').single()
  fail(error)
  const t = await tagId('Creditor Invoice')
  if (t) await supabase.from('booking_documents').update({ tag_id: t }).eq('id', documentId)
  return data!.id as string
}

export async function createFromUpload(bookingId: string, accountId: string, file: File): Promise<string> {
  const doc = await uploadBookingFile(file, bookingId, accountId, { tagId: await tagId('Creditor Invoice'), uploadedBy: await uid() })
  return createFromDocument(bookingId, doc.id)
}

export async function readWithAi(id: string): Promise<CheckResult | null> {
  const { data, error } = await supabase.functions.invoke('creditor-invoice-read', { body: { invoice_id: id } })
  if (error) {
    const ctx = (error as { context?: unknown }).context
    const msg = ctx instanceof Response ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null
    throw new Error(msg || error.message)
  }
  return (data?.check ?? null) as CheckResult | null
}

export async function recheck(id: string): Promise<void> {
  const { error } = await supabase.rpc('creditor_invoice_check', { p_id: id }); fail(error)
}

export async function updateInvoice(id: string, patch: Partial<CreditorInvoice>): Promise<void> {
  const { error } = await supabase.from('creditor_invoices').update(patch).eq('id', id); fail(error)
  await recheck(id)
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from('creditor_invoices').delete().eq('id', id); fail(error)
}

export async function approveInvoice(id: string, payBy: string, urgent: boolean, comment: string): Promise<void> {
  const { error } = await supabase.rpc('creditor_invoice_approve', { p_id: id, p_pay_by: payBy, p_urgent: urgent, p_comment: comment }); fail(error)
}

export async function disputeInvoice(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('creditor_invoice_dispute', { p_id: id, p_reason: reason }); fail(error)
}

export async function reopenInvoice(id: string): Promise<void> {
  const { error } = await supabase.rpc('creditor_invoice_reopen', { p_id: id }); fail(error)
}

export async function listEvents(id: string): Promise<InvoiceEvent[]> {
  const { data, error } = await supabase.from('creditor_invoice_events').select('id, action, detail, actor_name, created_at')
    .eq('invoice_id', id).order('id'); fail(error)
  return (data ?? []) as InvoiceEvent[]
}

export async function docUrl(documentId: string): Promise<{ url: string; mime: string | null; name: string }> {
  const { data, error } = await supabase.from('booking_documents').select('storage_path, mime_type, file_name').eq('id', documentId).single()
  fail(error)
  return { url: await signedDownloadUrl(data!.storage_path), mime: data!.mime_type, name: data!.file_name }
}

export async function saveStamped(inv: CreditorInvoice, meta: BookingMeta, bytes: Uint8Array): Promise<string> {
  const base = (inv.vendor_name || 'invoice').replace(/[^\w.-]+/g, '_').slice(0, 40)
  const name = `APPROVED_${base}_${(inv.invoice_no || inv.id.slice(0, 8)).replace(/[^\w.-]+/g, '_')}_v${inv.version}.pdf`
  const file = new File([bytes.slice().buffer as ArrayBuffer], name, { type: "application/pdf" })
  const doc = await uploadBookingFile(file, inv.booking_id, meta.account_id, { tagId: await tagId('Creditor Invoice (Approved)'), uploadedBy: await uid() })
  const { error } = await supabase.rpc('creditor_invoice_set_stamped', { p_id: inv.id, p_document_id: doc.id }); fail(error)
  return doc.id
}

// Approver gets a copy. approved_by_name holds the approver's staff email.
async function approverEmail(inv: CreditorInvoice): Promise<string[]> {
  const isEmail = (v: string | null | undefined) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  if (isEmail(inv.approved_by_name)) return [inv.approved_by_name!.toLowerCase()]
  const { data } = await supabase.from('creditor_invoices').select('approved_by').eq('id', inv.id).maybeSingle()
  if (!data?.approved_by) return []
  const { data: su } = await supabase.from('staff_users').select('email').eq('user_id', data.approved_by).maybeSingle()
  return isEmail(su?.email) ? [String(su!.email).toLowerCase()] : []
}

export async function sendToAccounts(inv: CreditorInvoice, meta: BookingMeta): Promise<void> {
  if (!inv.stamped_document_id) throw new Error('Stamp the invoice first')
  const amt = `${inv.currency} ${Number(inv.total ?? 0).toLocaleString('en-NZ', { minimumFractionDigits: 2 })}`
  const subject = `${inv.urgent ? 'URGENT ' : ''}Approved creditor invoice: ${inv.vendor_name ?? ''} ${inv.invoice_no ?? ''} | ${meta.booking_ref ?? ''} | Pay by ${inv.pay_by ?? ''}`.replace(/\s+/g, ' ').trim()
  const html = `<p>Hi Accounts,</p><p>Approved creditor invoice attached.</p><ul>`
    + `<li>Vendor: ${inv.vendor_name ?? '-'}</li><li>Invoice: ${inv.invoice_no ?? '-'}</li><li>Amount: ${amt}</li>`
    + `<li>Customer: ${meta.customer_name ?? '-'}</li><li>Job: ${meta.booking_ref ?? '-'}</li><li>ETA: ${meta.eta ?? '-'}</li><li>Pay by: ${inv.pay_by ?? '-'}${inv.urgent ? ' (URGENT)' : ''}</li>`
    + `<li>Approved by: ${inv.approved_by_name ?? '-'}</li>${inv.approval_comment ? `<li>Comment: ${inv.approval_comment}</li>` : ''}</ul>`
  const cc = await approverEmail(inv)
  await sendBookingEmail({ booking_id: inv.booking_id, to: [ACCOUNTS_EMAIL], cc, subject, html, document_ids: [inv.stamped_document_id], purpose: 'general' })
  const sentTo = [ACCOUNTS_EMAIL, ...cc.map((c) => `cc ${c}`)].join(', ')
  const { error } = await supabase.rpc('creditor_invoice_mark_sent', { p_id: inv.id, p_to: sentTo }); fail(error)
}
