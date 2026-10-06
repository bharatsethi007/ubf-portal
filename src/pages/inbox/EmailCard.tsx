// One email in Outlook 365 reading-pane style. Older emails collapse to a single line; actions live in a "..." menu.
import { useEffect, useRef, useState } from 'react'
import { Copy, ExternalLink, MoreHorizontal, PackagePlus, Paperclip, ReplyAll, StickyNote } from 'lucide-react'
import { toast } from 'sonner'
import type { InboxMessage } from './inboxApi'
import { avatarColors, initials } from './inboxFormat'
import { AttachmentTiles, cleanBody, inboxAction, isInlineJunk, outlookDate, splitQuoted } from './EmailParts'

type Addr = { name: string | null; address: string | null }
const names = (l: Addr[] | undefined) => (l ?? []).map((a) => a.name || a.address).filter(Boolean).join('; ')

function Menu({ m, text }: { m: InboxMessage; text: string }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const act = (fn: () => void) => () => { setOpen(false); fn() }
  const items = [
    { icon: ReplyAll, label: 'Reply all', run: () => inboxAction('compose', { mode: 'reply', via: 'email' }) },
    { icon: PackagePlus, label: 'Create booking', run: () => inboxAction('create-booking') },
    { icon: StickyNote, label: 'Add internal note', run: () => inboxAction('compose', { mode: 'note' }) },
    { icon: Copy, label: 'Copy text', run: () => void navigator.clipboard.writeText(text).then(() => toast.success('Copied')) },
    ...(m.email?.web_link ? [{ icon: ExternalLink, label: 'Open in Outlook', run: () => window.open(m.email!.web_link!, '_blank', 'noopener') }] : []),
  ]
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button type="button" className="ibx-mail__icon" aria-label="More actions" aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}><MoreHorizontal size={18} /></button>
      {open ? (
        <div className="ibx-menu" role="menu">
          {items.map(({ icon: Icon, label, run }) => (
            <button key={label} type="button" role="menuitem" onClick={act(run)}><Icon size={15} />{label}</button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function EmailCard({ m, initiallyOpen }: { m: InboxMessage; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  const [quoted, setQuoted] = useState(false)
  const em = m.email
  const sender = m.sender_name || em?.from || 'Unknown'
  const body = cleanBody(m.body)
  const [main, rest] = splitQuoted(body)
  const atts = (em?.attachments ?? []).filter((a) => !isInlineJunk(a))
  const av = avatarColors(sender)

  if (!open) {
    return (
      <button type="button" className="ibx-mail ibx-mail--closed" onClick={() => setOpen(true)}>
        <span className="ibx-av ibx-av--sm" style={av}>{initials(sender)}</span>
        <span className="ibx-mail__from" style={{ flex: 'none', maxWidth: 220 }}>{sender}</span>
        <span className="ibx-ellip" style={{ flex: 1, color: '#605E5C' }}>{main.replace(/\s+/g, ' ').slice(0, 200)}</span>
        {atts.length ? <Paperclip size={14} color="#605E5C" style={{ flex: 'none' }} /> : null}
        <span className="ibx-mail__date">{outlookDate(m.created_at)}</span>
      </button>
    )
  }

  return (
    <article className="ibx-mail">
      <header className="ibx-mail__head">
        <span className="ibx-av" style={{ ...av, cursor: 'pointer' }} onClick={() => setOpen(false)}>{initials(sender)}</span>
        <div style={{ minWidth: 0, flex: 1, cursor: 'pointer' }} onClick={() => setOpen(false)}>
          <div className="ibx-mail__from">
            {sender}{em?.from && em.from !== sender ? <span className="ibx-mail__addr"> &lt;{em.from}&gt;</span> : null}
          </div>
          {em?.to?.length ? <div className="ibx-mail__rcpt ibx-ellip">To: {names(em.to)}</div> : null}
          {em?.cc?.length ? <div className="ibx-mail__rcpt ibx-ellip">Cc: {names(em.cc)}</div> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 'none' }}>
          <button type="button" className="ibx-mail__icon" aria-label="Reply all" title="Reply all"
            onClick={() => inboxAction('compose', { mode: 'reply', via: 'email' })}><ReplyAll size={17} /></button>
          <Menu m={m} text={body} />
          <span className="ibx-mail__date" style={{ marginLeft: 6 }}>{outlookDate(m.created_at)}</span>
        </div>
      </header>
      <AttachmentTiles items={atts} />
      <div className="ibx-mail__body">{(main || '(no text)').split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div>
      {rest ? (
        <>
          <button type="button" className="ibx-mail__more" onClick={() => setQuoted(!quoted)} title={quoted ? 'Hide history' : 'Show history'}>···</button>
          {quoted ? <div className="ibx-mail__body ibx-mail__body--quoted">{rest.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div> : null}
        </>
      ) : null}
    </article>
  )
}
