import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Globe, Mail, Phone, X } from 'lucide-react'
import { toast } from 'sonner'
import type { ViewMode } from './conferencesApi'
import CardScanner, { type CardScannerHandle } from './CardScanner'
import { deleteMeetingCard, listMeetingCards, type MeetingCard } from './meetingCardsApi'
import './meetingCards.css'

export type MeetingCardsHandle = { openScanner: () => void; openContacts: () => void }

type Props = {
  meetingId: string
  agentId: string | null
  viewMode: ViewMode
  onCountChange?: (n: number) => void
}

const MeetingCards = forwardRef<MeetingCardsHandle, Props>(function MeetingCards(
  { meetingId, agentId, viewMode, onCountChange }: Props,
  ref,
) {
  const [cards, setCards] = useState<MeetingCard[]>([])
  const [loading, setLoading] = useState(true)
  const isMobile = viewMode === 'mobile'
  const scannerRef = useRef<CardScannerHandle>(null)
  const [showContacts, setShowContacts] = useState(false)

  useImperativeHandle(
    ref,
    () => ({
      openScanner: () => scannerRef.current?.open(),
      openContacts: () => setShowContacts(true),
    }),
    [],
  )

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

  useEffect(() => {
    onCountChange?.(cards.length)
  }, [cards, onCountChange])

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

      {showContacts && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowContacts(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-xl border border-border bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Contacts from cards</span>
              <button
                type="button"
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => setShowContacts(false)}
              >
                <X size={18} />
              </button>
            </div>
            {cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cards yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {cards.map((card) => {
                  const c = card.extracted
                  const phone = c?.mobile ?? c?.phone ?? null
                  return (
                    <div key={card.id} className="flex gap-3 rounded-lg border border-border p-3">
                      <img
                        src={card.image_url}
                        alt="Business card"
                        className="h-16 w-24 shrink-0 cursor-pointer rounded object-cover"
                        onClick={() =>
                          window.open(card.image_url, '_blank', 'noopener,noreferrer')
                        }
                      />
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="font-medium text-foreground">
                          {c?.person_name ?? '—'}
                          {c?.title ? `, ${c.title}` : ''}
                        </div>
                        {c?.company && <div className="text-muted-foreground">{c.company}</div>}
                        {c?.email && (
                          <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                            <Mail size={14} />
                            <a href={`mailto:${c.email}`} className="truncate hover:text-primary">
                              {c.email}
                            </a>
                          </div>
                        )}
                        {phone && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone size={14} />
                            <span>{phone}</span>
                          </div>
                        )}
                        {c?.website && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Globe size={14} />
                            <span className="truncate">{c.website}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
)

export default MeetingCards
