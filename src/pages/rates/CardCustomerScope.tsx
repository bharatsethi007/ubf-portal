import { useEffect, useState, type CSSProperties } from 'react'
import { Lock, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/supabase'
import CustomerPicker, { type CustomerPickerValue } from '@/components/bookings/CustomerPicker'

type Props = { cardId: string; labelStyle?: CSSProperties; fieldStyle?: CSSProperties }
type Shared = { account_id: string; name: string }

/**
 * Who can see this card. No customers = everyone. One or more = only them (named-account / tender rates).
 * Saves on each add or remove, separate from the header Save button.
 */
export default function CardCustomerScope({ cardId, labelStyle, fieldStyle }: Props) {
  const [shared, setShared] = useState<Shared[]>([])
  const [ready, setReady] = useState(false)
  const [pickKey, setPickKey] = useState(0)

  useEffect(() => {
    let live = true
    void (async () => {
      const { data, error } = await supabase
        .from('rate_card_customers').select('account_id, customers(name)').eq('rate_card_id', cardId).order('created_at')
      if (!live) return
      if (error) toast.error(error.message)
      setShared(((data ?? []) as unknown as { account_id: string; customers: { name: string | null } | null }[])
        .map((r) => ({ account_id: r.account_id, name: r.customers?.name ?? r.account_id })))
      setReady(true)
    })()
    return () => { live = false }
  }, [cardId])

  async function add(v: CustomerPickerValue | null) {
    setPickKey((k) => k + 1)
    if (!v || shared.some((s) => s.account_id === v.account_id)) return
    const { error } = await supabase.from('rate_card_customers').insert({ rate_card_id: cardId, account_id: v.account_id })
    if (error) { toast.error(error.message); return }
    setShared((s) => [...s, { account_id: v.account_id, name: v.name }])
    toast.success(`Shared with ${v.name}`)
  }

  async function remove(s: Shared) {
    const { error } = await supabase.from('rate_card_customers').delete().eq('rate_card_id', cardId).eq('account_id', s.account_id)
    if (error) { toast.error(error.message); return }
    setShared((x) => x.filter((y) => y.account_id !== s.account_id))
  }

  return (
    <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
      <label style={{ ...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {shared.length > 0 && <Lock size={12} />} Private to customers
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {shared.map((s) => (
          <span key={s.account_id} title={s.account_id}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 6px 4px 10px', borderRadius: 6, background: '#EAEDF6', color: '#0A2472', fontSize: 13 }}>
            {s.name}
            <button type="button" onClick={() => void remove(s)} aria-label={`Remove ${s.name}`}
              style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'inherit', display: 'inline-flex', padding: 2 }}>
              <X size={13} />
            </button>
          </span>
        ))}
        <div style={{ width: 260 }}>
          {ready ? <CustomerPicker key={pickKey} value={null} onChange={(v) => void add(v)} compact /> : <input className="input" disabled placeholder="Loading" />}
        </div>
      </div>
      <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)', marginTop: 4 }}>
        {shared.length ? `Only these ${shared.length === 1 ? 'customer sees' : `${shared.length} customers see`} this card on the portal and in quotes.` : 'None = all customers see this card.'}
      </span>
    </div>
  )
}
