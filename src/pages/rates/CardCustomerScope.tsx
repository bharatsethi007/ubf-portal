import { useEffect, useState, type CSSProperties } from 'react'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/supabase'
import CustomerPicker, { type CustomerPickerValue } from '@/components/bookings/CustomerPicker'

type Props = { cardId: string; labelStyle?: CSSProperties; fieldStyle?: CSSProperties }

/**
 * Who can see this card. Blank = all customers. A customer = only them (carrier named-account rates).
 * Saves on change, separate from the header Save button.
 */
export default function CardCustomerScope({ cardId, labelStyle, fieldStyle }: Props) {
  const [value, setValue] = useState<CustomerPickerValue | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let live = true
    void (async () => {
      const { data } = await supabase.from('rate_cards').select('account_id, customers(name)').eq('id', cardId).maybeSingle()
      if (!live) return
      const row = data as { account_id: string | null; customers: { name: string | null } | null } | null
      setValue(row?.account_id ? ({ account_id: row.account_id, name: row.customers?.name ?? row.account_id } as CustomerPickerValue) : null)
      setReady(true)
    })()
    return () => { live = false }
  }, [cardId])

  async function change(next: CustomerPickerValue | null) {
    const prev = value
    setValue(next)
    const { error } = await supabase.from('rate_cards').update({ account_id: next?.account_id ?? null }).eq('id', cardId)
    if (error) { setValue(prev); toast.error(error.message); return }
    toast.success(next ? `Private to ${next.name}` : 'Visible to all customers')
  }

  return (
    <div style={fieldStyle}>
      <label style={{ ...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {value && <Lock size={12} />} Private to customer
      </label>
      {ready ? (
        <CustomerPicker value={value} onChange={(v) => void change(v)} compact />
      ) : (
        <input className="input" disabled placeholder="Loading" />
      )}
      <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)', marginTop: 4 }}>
        {value ? 'Only this customer sees these rates on the portal and in quotes.' : 'Blank = all customers.'}
      </span>
    </div>
  )
}
