import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '../../../supabase'
import { useCustomerSearch } from '../../../hooks/useBookings'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { createCard, DEFAULT_TERMS } from './rateCardsApi'

type Props = { open: boolean; onOpenChange: (o: boolean) => void; account?: { id: string; name: string } }

function nextMonthStart(): string {
  const d = new Date(); d.setMonth(d.getMonth() + 1, 1)
  return d.toLocaleDateString('en-CA')
}
function plusMonths(iso: string, m: number): string {
  const d = new Date(`${iso}T00:00:00`); d.setMonth(d.getMonth() + m); d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('en-CA')
}

/** Pick customer, title and validity, then open the builder. */
export default function NewRateCardDialog({ open, onOpenChange, account }: Props) {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [cust, setCust] = useState<{ id: string; name: string } | null>(null)
  const [title, setTitle] = useState('')
  const [from, setFrom] = useState(nextMonthStart())
  const [to, setTo] = useState(plusMonths(nextMonthStart(), 3))
  const [busy, setBusy] = useState(false)
  const debounced = useDebouncedValue(term, 250)
  const { data: results } = useCustomerSearch(cust ? '' : debounced)

  useEffect(() => {
    if (!open) return
    setCust(account ?? null); setTerm(''); setTitle('')
    setFrom(nextMonthStart()); setTo(plusMonths(nextMonthStart(), 3))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account?.id])

  async function create() {
    if (!cust) return
    setBusy(true)
    try {
      const { data } = await supabase.auth.getUser()
      const me = data.user?.id ?? null
      const id = await createCard({
        account_id: cust.id, title: title.trim(), valid_from: from, valid_to: to, sales_id: me, pricing_id: me, ...DEFAULT_TERMS,
      })
      onOpenChange(false)
      navigate(`/quotes/rate-cards/${id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create rate card')
    } finally {
      setBusy(false)
    }
  }

  const lbl = 'text-[11.5px] text-[#5B6474]'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>New rate card</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="relative flex flex-col gap-1">
            <span className={lbl}>Customer</span>
            {cust ? (
              <div className="flex items-center justify-between rounded-lg border border-[#E6E8EE] px-3 py-2 text-[13px]">
                <span>{cust.name} <span className="font-mono text-[11.5px] text-[#5B6474]">{cust.id}</span></span>
                {!account && <button type="button" className="text-[12px] text-[#0A2472]" onClick={() => setCust(null)}>Change</button>}
              </div>
            ) : (
              <>
                <input className="input" autoFocus placeholder="Search customer name" value={term} onChange={(e) => setTerm(e.target.value)} />
                {results.length > 0 && (
                  <div className="absolute left-0 right-0 top-[58px] z-10 max-h-64 overflow-y-auto rounded-lg border border-[#E6E8EE] bg-white shadow-lg">
                    {results.map((c) => (
                      <button key={c.account_id} type="button" className="flex w-full justify-between px-3 py-2 text-left text-[13px] hover:bg-[#F7F8FA]"
                        onClick={() => setCust({ id: c.account_id, name: c.name })}>
                        <span>{c.name}</span><span className="font-mono text-[11.5px] text-[#5B6474]">{c.account_id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <label className="flex flex-col gap-1"><span className={lbl}>Title (shown on the PDF)</span>
            <input className="input" placeholder="e.g. Asia import FCL and LCL" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span className={lbl}>Valid from</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="flex flex-col gap-1"><span className={lbl}>Valid to</span><input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={busy || !cust || !from || !to || to < from} onClick={() => void create()}>{busy ? 'Creating…' : 'Create and add lanes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
