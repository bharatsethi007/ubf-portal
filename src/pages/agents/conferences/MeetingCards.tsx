import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ViewMode } from './conferencesApi'
import CardScanner, { type CardScannerHandle } from './CardScanner'
import { deleteMeetingCard, listMeetingCards, type MeetingCard } from './meetingCardsApi'
import './meetingCards.css'

export type MeetingCardsHandle = { openScanner: () => void }

type Props = {
  meetingId: string
  agentId: string | null
  viewMode: ViewMode
}

const MeetingCards = forwardRef<MeetingCardsHandle, Props>(function MeetingCards(
  { meetingId, agentId, viewMode }: Props,
  ref,
) {
  const [cards, setCards] = useState<MeetingCard[]>([])
  const [loading, setLoading] = useState(true)
  const isMobile = viewMode === 'mobile'
  const scannerRef = useRef<CardScannerHandle>(null)

  useImperativeHandle(ref, () => ({ openScanner: () => scannerRef.current?.open() }), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void listMeetingCards(meetingId)
      .then((rows) => {
        if (!cancelled) setCards(rows)
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Failed to load cards')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [meetingId])

  async function handleDelete(cardId: string) {
    if (!window.confirm('Remove this business card?')) return
    try {
      await deleteMeetingCard(cardId)
      setCards((prev) => prev.filter((c) => c.id !== cardId))
      toast.success('Card removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete card')
    }
  }

  return (
    <div className={`conf-cards${isMobile ? ' conf-cards--mobile' : ''}`}>
      {loading ? (
        <p className="text-muted-foreground conf-cards__loading">Loading cards…</p>
      ) : cards.length > 0 ? (
        <div className="conf-cards-strip">
          {cards.map((card) => (
            <div key={card.id} className="conf-card-thumb">
              <img
                src={card.image_url}
                alt="Business card"
                onClick={() => window.open(card.image_url, '_blank', 'noopener,noreferrer')}
              />
              <button
                type="button"
                className="conf-card-thumb__del"
                aria-label="Delete card"
                onClick={() => void handleDelete(card.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <CardScanner
        ref={scannerRef}
        hideTrigger
        meetingId={meetingId}
        agentId={agentId}
        onCardAdded={(c) => setCards((prev) => [...prev, c])}
      />
    </div>
  )
}
)

export default MeetingCards
