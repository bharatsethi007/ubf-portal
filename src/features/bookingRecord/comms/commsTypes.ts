export type CommActivityType = 'phone_call' | 'email' | 'im' | 'note'
export type CommDirection = 'incoming' | 'outgoing' | 'internal'
export type CommCategory =
  | 'complaint' | 'cartage_booking' | 'follow_up' | 'customer_enquiry'
  | 'documentation' | 'customs' | 'delivery' | 'collection' | 'pod'
  | 'accounts' | 'damage_loss' | 'delay' | 'carrier' | 'other'
export type CommSentiment = 'positive' | 'neutral' | 'negative' | 'at_risk'
export type ComplaintType =
  | 'delay' | 'damage' | 'lost_freight' | 'service' | 'charges'
  | 'documentation' | 'delivery' | 'other'
export type ComplaintSeverity = 'low' | 'medium' | 'high' | 'critical'
export type ComplaintStatus =
  | 'open' | 'investigating' | 'awaiting_information' | 'resolved' | 'closed'

export type Option<T extends string> = { value: T; label: string }

export const ACTIVITY_TYPES: Option<CommActivityType>[] = [
  { value: 'phone_call', label: 'Phone call' },
  { value: 'email', label: 'Email' },
  { value: 'im', label: 'SMS / WhatsApp / WeChat' },
  { value: 'note', label: 'Note' },
]
export const DIRECTIONS: Option<CommDirection>[] = [
  { value: 'incoming', label: 'Incoming' },
  { value: 'outgoing', label: 'Outgoing' },
  { value: 'internal', label: 'Internal' },
]
export const CATEGORIES: Option<CommCategory>[] = [
  { value: 'complaint', label: 'Complaint' },
  { value: 'cartage_booking', label: 'Cartage booking' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'customer_enquiry', label: 'Customer enquiry' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'customs', label: 'Customs' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'collection', label: 'Collection' },
  { value: 'pod', label: 'POD' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'damage_loss', label: 'Damage / loss' },
  { value: 'delay', label: 'Delay' },
  { value: 'carrier', label: 'Airline / shipping line' },
  { value: 'other', label: 'Other' },
]
export const SENTIMENTS: Option<CommSentiment>[] = [
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
  { value: 'at_risk', label: 'At-risk' },
]
export const COMPLAINT_TYPES: Option<ComplaintType>[] = [
  { value: 'delay', label: 'Delay' },
  { value: 'damage', label: 'Damage' },
  { value: 'lost_freight', label: 'Lost freight' },
  { value: 'service', label: 'Service' },
  { value: 'charges', label: 'Charges' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'other', label: 'Other' },
]
export const COMPLAINT_SEVERITIES: Option<ComplaintSeverity>[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]
export const COMPLAINT_STATUSES: Option<ComplaintStatus>[] = [
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'awaiting_information', label: 'Awaiting information' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

export function labelFor<T extends string>(opts: Option<T>[], value: T | null | undefined): string {
  if (!value) return ''
  return opts.find((o) => o.value === value)?.label ?? value
}

export type BookingComm = {
  id: string
  booking_id: string
  occurred_at: string
  activity_type: CommActivityType
  direction: CommDirection
  category: CommCategory
  sentiment: CommSentiment | null
  contact_name: string | null
  subject: string | null
  body: string
  created_by: string | null
  author_email: string | null
  author_initials: string | null
  complaint_type: ComplaintType | null
  complaint_severity: ComplaintSeverity | null
  complaint_status: ComplaintStatus | null
  created_at: string
}

export type NewCommInput = {
  activity_type: CommActivityType
  direction: CommDirection
  category: CommCategory
  sentiment: CommSentiment | null
  contact_name: string | null
  subject: string | null
  body: string
  occurred_at?: string | null
  complaint_type?: ComplaintType | null
  complaint_severity?: ComplaintSeverity | null
  complaint_status?: ComplaintStatus | null
}
