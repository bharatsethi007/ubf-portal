import { useEffect, useState } from 'react'
import RatesPreview from './RatesPreview'
import CustomerPricingList from './CustomerPricingList'
import SharedCardsList from './SharedCardsList'
import CustomerRateCards from './CustomerRateCards'
import { customerName } from './customerRatesApi'

/** Customer record > Rates: what this customer pays and sees on the portal. */
export function CustomerRatesTab({ accountId }: { accountId: string }) {
  const [name, setName] = useState(accountId)
  useEffect(() => { void customerName(accountId).then(setName) }, [accountId])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <CustomerRateCards accountId={accountId} name={name} />
      <RatesPreview accountId={accountId} />
      <CustomerPricingList accountId={accountId} name={name} />
      <SharedCardsList accountId={accountId} />
    </div>
  )
}
