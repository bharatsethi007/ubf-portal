import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Check, Globe, Mail, Phone, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { ViewMode } from './conferencesApi'
import CardScanner, { type CardScannerHandle } from './CardScanner'
import { deleteMeetingCard, listMeetingCards, type MeetingCard } from './meetingCardsApi'
import {
  addAgentContact,
  addAgentContactDedup,
  deleteAgentContact,
  listAgentContacts,
  type AgentContact,
} from './meetingsApi'
import './meetingCards.css'

export type MeetingCardsHandle = { openScanner: () => void; openContacts: () => void }

type Props = {
  meetingId: string
  agentId: string | null
  viewMode: ViewMode
  onCountChange?: (n: number) => void
  hideStrip?: boolean
}

const EMPTY_FORM = { name: '', role: '', email: '', phone: '' }

const MeetingCards = forwardRef<MeetingCardsHandle, Props>(function MeetingCards(
  { meetingId, agentId, viewMode, onCountChange, hideStrip }: Props,
  ref,
) {
  const [cards, setCards] = useState<MeetingCard[]>([])
  const [loading, setLoading] = useState(true)
  const isMobile = viewMode === 'mobile'
  const scannerRef = useRef<CardScannerHandle>(null)
  const [showContacts, setShowContacts] = useState(false)
  const [contacts, setContacts] = useState<AgentContact[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [savingContact, setSavingContact] = useState(false)

  useImperativeHandle(
    ref,
    () => ({
      openScanner: () => scannerRef.current?.open(),
      openContacts: () => setShowContacts(true),
    }),
    [],
  )

  const loadContacts = useCallback(async () => {
    if (!agentId) {
      setContacts([])
      return
    }
    try {
      setContacts(await listAgentContacts(agentId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load contacts')
    }
  }, [agentId])

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
    void loadContacts()
  }, [loadContacts])

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

  async function handleAddContact() {
    if (!agentId || !form.name.trim()) return
    setSavingContact(true)
    try {
      await addAgentContact(agentId, {
        name: form.name.trim(),
        role: form.role.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      })
      toast.success('Contact added')
      setForm(EMPTY_FORM)
      setAdding(false)
      await loadContacts()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add contact')
    } finally {
      setSavingContact(false)
    }
  }

  async function handleDeleteContact(id: string) {
    if (!window.confirm('Remove this contact?')) return
    try {
      await deleteAgentContact(id)
      setContacts((prev) => prev.filter((c) => c.id !== id))
      toast.success('Contact removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove contact')
    }
  }

  async function handleSaveCardContact(c: NonNullable<MeetingCard['extracted']>) {
    if (!agentId || !c.person_name) return
    try {
      const res = await addAgentContactDedup(agentId, {
        name: c.person_name,
        role: c.title,
        email: c.email,
        phone: c.mobile ?? c.phone,
      })
      toast.success(res === 'added' ? 'Contact saved' : 'Already saved')
      await loadContacts()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save contact')
    }
  }

  const cardContacts = cards
    .map((c) => c.extracted)
    .filter((c): c is NonNullable<typeof c> => !!c && !!c.person_name)

  const matchesCard = (a: AgentContact, c: NonNullable<MeetingCard['extracted']>) => {
    const ae = a.email?.trim().toLowerCase()
    const ce = c.email?.trim().toLowerCase()
    if (ae && ce) return ae === ce
    return a.name.trim().toLowerCase() === (c.person_name ?? '').trim().toLowerCase()
  }
  const isCardSaved = (c: NonNullable<MeetingCard['extracted']>) =>
    contacts.some((a) => matchesCard(a, c))
  const manualContacts = contacts.filter((a) => !cardContacts.some((c) => matchesCard(a, c)))

  return (
    <div className={`conf-cards${isMobile ? ' conf-cards--mobile' : ''}`}>
      {!hideStrip &&
        (loading ? (
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
        ) : null)}

      <CardScanner
        ref={scannerRef}
        hideTrigger
        meetingId={meetingId}
        agentId={agentId}
        onCardAdded={(c) => setCards((prev) => [...prev, c])}
        onContactSaved={() => void loadContacts()}
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
              <span className="text-sm font-medium text-foreground">Contacts</span>
              <button
                type="button"
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => setShowContacts(false)}
              >
                <X size={18} />
              </button>
            </div>

            {agentId ? (
              <div className="flex flex-col gap-2">
                {manualContacts.length === 0 && cardContacts.length === 0 && !adding && (
                  <p className="text-sm text-muted-foreground">No contacts yet.</p>
                )}

                {manualContacts.map((ct) => (
                  <div
                    key={ct.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0 text-sm">
                      <div className="font-medium text-foreground">
                        {ct.name}
                        {ct.role ? `, ${ct.role}` : ''}
                      </div>
                      {ct.email && (
                        <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                          <Mail size={14} />
                          <a href={`mailto:${ct.email}`} className="truncate hover:text-primary">
                            {ct.email}
                          </a>
                        </div>
                      )}
                      {ct.phone && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone size={14} />
                          <span>{ct.phone}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove contact"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => void handleDeleteContact(ct.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}

                {cardContacts.map((c, i) => {
                  const saved = isCardSaved(c)
                  return (
                    <div
                      key={`card-${i}`}
                      className="flex items-start justify-between gap-2 rounded-lg border border-dashed border-border p-3"
                    >
                      <div className="min-w-0 text-sm">
                        <div className="font-medium text-foreground">
                          {c.person_name}
                          {c.title ? `, ${c.title}` : ''}
                        </div>
                        {c.company && <div className="text-muted-foreground">{c.company}</div>}
                        {c.email && (
                          <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                            <Mail size={14} />
                            <span className="truncate">{c.email}</span>
                          </div>
                        )}
                        {(c.mobile ?? c.phone) && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone size={14} />
                            <span>{c.mobile ?? c.phone}</span>
                          </div>
                        )}
                        <span className="mt-1 inline-block text-[11px] text-muted-foreground">
                          From scanned card
                        </span>
                      </div>
                      {saved ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600">
                          <Check size={14} />
                          Saved
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleSaveCardContact(c)}
                        >
                          Save
                        </Button>
                      )}
                    </div>
                  )
                })}

                {adding ? (
                  <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <input
                      className="input"
                      placeholder="Name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="Role / title"
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="Email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="Phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingContact || !form.name.trim()}
                        onClick={() => void handleAddContact()}
                      >
                        {savingContact ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAdding(false)
                          setForm(EMPTY_FORM)
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="self-start"
                    onClick={() => setAdding(true)}
                  >
                    <Plus className="size-4" />
                    Add contact
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {cardContacts.length > 0 &&
                  cardContacts.map((c, i) => (
                    <div key={i} className="rounded-lg border border-border p-3 text-sm">
                      <div className="font-medium text-foreground">
                        {c.person_name}
                        {c.title ? `, ${c.title}` : ''}
                      </div>
                      {c.company && <div className="text-muted-foreground">{c.company}</div>}
                      {c.email && (
                        <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                          <Mail size={14} />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                      {(c.mobile ?? c.phone) && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone size={14} />
                          <span>{c.mobile ?? c.phone}</span>
                        </div>
                      )}
                      {c.website && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Globe size={14} />
                          <span className="truncate">{c.website}</span>
                        </div>
                      )}
                    </div>
                  ))}
                <p className="text-xs text-muted-foreground">
                  Link an agent to this meeting to save and manage contacts.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

export default MeetingCards
