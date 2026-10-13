import type { ChangeEvent } from 'react'
import CustomerPicker, { type CustomerPickerValue } from '@/components/bookings/CustomerPicker'
import type { EaParty } from '@/pages/inbox/eaBookingApi'
import type { Account } from './accountMatch'

type Props = {
  label: string
  account: CustomerPickerValue | null
  matched: Account | null
  party: EaParty
  quick?: { code: string; name: string; text: string }
  onAccount: (v: CustomerPickerValue | null) => void
  onParty: (p: EaParty) => void
}

const inp = 'h-[28px] w-full rounded-[6px] border border-[#E3E6EB] bg-white px-2 text-[12px] text-[#14161A] outline-none focus:border-[#0A2472]'
const VIA: Record<Account['via'], string> = { history: 'used before for this sender', domain: 'email domain', name: 'company name' }

/** One party: TradeWindow account first (codes go to the XML), then contact details from the email. */
export default function EaIntakeParty({ label, account, matched, party, quick, onAccount, onParty }: Props) {
  const auto = account && matched && matched.account_id === account.account_id
  const set = (k: keyof EaParty) => (e: ChangeEvent<HTMLInputElement>) => onParty({ ...party, [k]: e.target.value })
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 rounded-[10px] border border-[#EEF0F3] p-3">
      <legend className="px-1 text-[10.5px] uppercase tracking-[.04em] text-[#6B7280]">{label}</legend>
      {account ? (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="bk-mono rounded bg-[#EEF1F9] px-1.5 text-[10.5px] leading-[16px] text-[#0A2472]">{account.account_id}</span>
            <span className="min-w-0 truncate text-[12.5px] font-medium text-[#14161A]">{account.name}</span>
            <button type="button" onClick={() => onAccount(null)} className="ml-auto w-auto border-0 bg-transparent p-0 text-[11px] font-medium text-[#0A2472] hover:underline">Change</button>
          </div>
          <span className="truncate text-[11.5px] text-[#5B616E]">{[account.address1, account.address2, account.city].filter(Boolean).join(', ') || 'No address on account'}</span>
          {auto ? <span className="text-[10.5px] text-[#067647]">Matched by {VIA[matched.via]}{matched.via === 'name' ? ` · ${Math.round(matched.score * 100)}%` : ''}. Check it.</span> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <CustomerPicker compact value={null} onChange={onAccount} />
          <div className="flex flex-wrap items-center gap-x-3 text-[11px]">
            <span className="text-[#B54708]">Not linked to TradeWindow</span>
            {party.name ? <span className="truncate text-[#6B7280]">Email says: {party.name}</span> : null}
            {quick ? <button type="button" onClick={() => onAccount({ account_id: quick.code, name: quick.name })} className="w-auto border-0 bg-transparent p-0 font-medium text-[#0A2472] hover:underline">{quick.text}</button> : null}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        {account ? null : <input aria-label={`${label} company`} placeholder="Company (from email)" value={party.name ?? ''} onChange={set('name')} className={`${inp} col-span-2`} />}
        <input aria-label={`${label} contact`} placeholder="Contact" value={party.contact ?? ''} onChange={set('contact')} className={inp} />
        <input aria-label={`${label} phone`} placeholder="Phone" value={party.phone ?? ''} onChange={set('phone')} className={inp} />
        <input aria-label={`${label} email`} placeholder="Email" value={party.email ?? ''} onChange={set('email')} className={`${inp} col-span-2`} />
      </div>
    </fieldset>
  )
}
