import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fmtDate, todayIso, type SharedCard } from './rateCardsApi'
import { rateCardFromSetup } from './setupCardsApi'

type Props = { cards: SharedCard[]; open: boolean; onOpenChange: (o: boolean) => void }

/** Make one customer rate card (proposal) from Setup cards shared with the same customer. */
export default function FromSetupDialog({ cards, open, onOpenChange }: Props) {
  const navigate = useNavigate()
  // Customers every picked card is shared with.
  const common = useMemo(() => {
    if (!cards.length) return [] as { id: string; name: string }[]
    const first = cards[0].account_ids.map((id, i) => ({ id, name: cards[0].customers[i] ?? id }))
    return first.filter((c) => cards.every((k) => k.account_ids.includes(c.id)))
  }, [cards])
  const [account, setAccount] = useState('')
  const [title, setTitle] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const t = todayIso()
    const starts = cards.map((c) => c.valid_from).filter(Boolean) as string[]
    const ends = cards.map((c) => c.valid_to).filter(Boolean) as string[]
    const start = starts.length ? starts.sort().slice(-1)[0] : t
    setAccount(common[0]?.id ?? '')
    setTitle(cards.length === 1 ? cards[0].title ?? '' : (cards[0].title ?? '').split('·')[0].trim())
    setFrom(start > t ? start : t)
    setTo(ends.length ? ends.sort()[0] : '')
  }, [open, cards, common])

  async function go() {
    setBusy(true)
    try {
      const id = await rateCardFromSetup(cards.map((c) => c.id), account, from, to, title)
      toast.success('Draft rate card created')
      onOpenChange(false)
      navigate(`/quotes/rate-cards/${id}`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }

  const lbl = 'text-[11.5px] text-[#5B6474]'
  const lanes = cards.reduce((t, c) => t + c.lanes, 0)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Make customer rate card</DialogTitle>
          <p className="m-0 text-[12px] text-[#5B6474]">{cards.length} Setup card{cards.length > 1 ? 's' : ''} · {lanes} lanes. Sells come from each card's prices and margins. You can edit, add the PDF, then send for approval.</p>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <ul className="m-0 flex max-h-40 list-none flex-col gap-1 overflow-y-auto rounded-lg border border-[#E6E8EE] p-2 text-[12.5px]">
            {cards.map((c) => <li key={c.id} className="flex justify-between gap-3"><span className="truncate">{c.title}</span><span className="whitespace-nowrap text-[#5B6474]">{c.lanes} lanes · to {fmtDate(c.valid_to)}</span></li>)}
          </ul>
          {common.length === 0 ? (
            <div className="rounded-lg bg-[#FEF3F2] px-3 py-2 text-[12.5px] text-[#B42318]">These cards are not shared with the same customer. Pick cards for one customer.</div>
          ) : (
            <label className="flex flex-col gap-1"><span className={lbl}>Customer</span>
              <select className="input" value={account} onChange={(e) => setAccount(e.target.value)} disabled={common.length === 1}>
                {common.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}</select></label>
          )}
          <label className="flex flex-col gap-1"><span className={lbl}>Title (on the PDF)</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span className={lbl}>Valid from</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="flex flex-col gap-1"><span className={lbl}>Valid to</span><input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
          <span className={lbl}>The Setup cards stay as they are. Once the rate card is approved, its prices win for this customer.</span>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={busy || !account || !from || !to || to < from} onClick={() => void go()}>{busy ? 'Creating…' : 'Create draft rate card'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
