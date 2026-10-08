// Payment reminder wording by stage. Staff can edit before sending; the invoice table is added by the server.
export type Stage = 'friendly' | 'firm' | 'final'

export const STAGE_LABEL: Record<Stage, string> = { friendly: '1-30 days', firm: '31-60 days', final: '60+ days' }

export function reminderTemplate(stage: Stage, customer: string, overdue: string): { subject: string; text: string } {
  const sign = 'Kind regards,\nUB Freight Accounts\naccounts.nz@ubfreight.com'
  if (stage === 'final') {
    return {
      subject: `Final notice: overdue account, ${customer}`,
      text: `Hello,\n\nDespite earlier reminders, ${overdue} on your account is now more than 60 days overdue. The open invoices are listed below.\n\nPlease arrange payment within 7 days, or contact us today to agree a payment plan. If we do not hear from you, we will need to place the account on hold for new shipments until it is brought up to date.\n\nIf payment has already been made, please send the remittance so we can match it.\n\n${sign}`,
    }
  }
  if (stage === 'firm') {
    return {
      subject: `Overdue account: ${customer}`,
      text: `Hello,\n\n${overdue} on your account is now more than 30 days overdue. The open invoices are listed below.\n\nPlease arrange payment within 7 days, or let us know if any invoice is disputed so we can resolve it quickly.\n\nIf you have already paid, thank you, and please send the remittance so we can match it.\n\n${sign}`,
    }
  }
  return {
    subject: `Account reminder: ${customer}`,
    text: `Hello,\n\nA friendly reminder that the invoices below are now past due (${overdue} in total). Could you please arrange payment, or let us know if anything is holding them up?\n\nIf you have already paid, thank you, and please send the remittance so we can match it.\n\n${sign}`,
  }
}

export const KIND_LABEL: Record<string, string> = {
  note: 'Note', call: 'Call', promise: 'Promise to pay', email: 'Email sent', dispute: 'Dispute', hold: 'Account on hold',
}
