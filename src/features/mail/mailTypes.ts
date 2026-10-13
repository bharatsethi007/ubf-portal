/** Which mailbox a floating mail bubble shows, and the record (job or quote) the current screen is on. */
export type MailRecord = { kind: 'booking' | 'quote'; id: string; ref?: string | null }

export type MailboxConfig = {
  mailbox: string
  title: string
  /** Attachment "Add to job" button in the docked preview. Bookings only. */
  docsToJob?: boolean
}

export const EA_MAILBOX: MailboxConfig = { mailbox: 'exportair.nz@ubfreight.com', title: 'Export air mail', docsToJob: true }
export const SALES_MAILBOX_CFG: MailboxConfig = { mailbox: 'salessupport.nz@ubfreight.com', title: 'Sales support mail' }
