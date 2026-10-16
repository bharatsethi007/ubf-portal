import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCustomerSearch } from '../../../hooks/useBookings'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { copyCard, daysBetween, type RateCard } from './rateCardsApi'

type Props = { card: RateCard; lanes: number; open: boolean; onOpenChange: (o: boolean) => void }

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }

/** Copy a rate card as a new draft: same customer with new dates, or another customer. */
export default function CopyRateCardDialog({ card, lanes, open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const [cust, setCust] = useState({ id: card.account_id, name: card.customer })
  const [term, setTerm] = useState('')
  const [picking, setPicking] = useState(false)
  const [title, setTitle] = useState(card.title)
  const [from, setFrom] = useState(card.valid_from)
  const [to, setTo] = useState(card.valid_to)
  const [busy, setBusy] = useState(false)
  const debounced = useDebouncedValue(term, 250)
  const { data: results } = useCustomerSearch(picking ? debounced : '')

  useEffect(() => {
    if (!open) return
    const len = daysBetween(card.valid_from, card.valid_to)
    setCust({ id: card.account_id, name: card.customer }); setTitle(card.title); setPicking(false); setTerm('')
    setFrom(addDays(card.valid_to, 1)); setTo(addDays(card.valid_to, 1 + len))
  }, [open, card])

  async function go() {
    setBusy(true)
    try {
      const id = await copyCard(card.id, cust.id, from, to, title)
      toast.success('Copied as a new draft')
      onOpenChange(false)
      navigate(`/quotes/rate-cards/${id}`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Copy failed') } finally { setBusy(false) }
  }

  const lbl = 'text-[11.5px] text-[#5B6474]'
  const same = cust.id === card.account_id
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Copy rate card</DialogTitle>
          <p className="m-0 text-[12px] text-[#5B6474]">{card.ref} · {lanes} lanes. Copies lanes, margins, local charges and terms into a new draft. It still needs approval.</p>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="relative flex flex-col gap-1">
            <span className={lbl}>Customer</span>
            {picking ? (<>
              <input className="input" autoFocus placeholder="Search customer name" value={term} onChange={(e) => setTerm(e.target.value)} />
              {results.length > 0 && (
                <div className="absolute left-0 right-0 top-[58px] z-10 max-h-64 overflow-y-auto rounded-lg border border-[#E6E8EE] bg-white shadow-lg">
                  {results.map((c) => (
                    <button key={c.account_id} type="button" className="flex w-full justify-between px-3 py-2 text-left text-[13px] hover:bg-[#F7F8FA]"
                      onClick={() => { setCust({ id: c.account_id, name: c.name }); setPicking(false) }}>
                      <span>{c.name}</span><span className="font-mono text-[11.5px] text-[#5B6474]">{c.account_id}</span>
                    </button>
                  ))}
                </div>
              )}
            </>) : (
              <div className="flex items-center justify-between rounded-lg border border-[#E6E8EE] px-3 py-2 text-[13px]">
                <span>{cust.name} <span className="font-mono text-[11.5px] text-[#5B6474]">{cust.id}</span>{same && <span className="ml-1.5 text-[11.5px] text-[#5B6474]">same customer</span>}</span>
                <span className="flex gap-3">
                  {!same && <button type="button" className="text-[12px] text-[#5B6474]" onClick={() => setCust({ id: card.account_id, name: card.customer })}>Same customer</button>}
                  <button type="button" className="text-[12px] text-[#0A2472]" onClick={() => setPicking(true)}>Another customer</button>
                </span>
              </div>
            )}
          </div>
          <label className="flex flex-col gap-1"><span className={lbl}>Title</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span className={lbl}>Valid from</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="flex flex-col gap-1"><span className={lbl}>Valid to</span><input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
          <span className={lbl}>Buy rates are copied as they were. Check the "Buy now" warnings on the new card before sending for approval.</span>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={busy || picking || !from || !to || to < from} onClick={() => void go()}>{busy ? 'Copying…' : 'Copy as new draft'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
