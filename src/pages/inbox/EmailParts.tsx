// Email helpers for the Outlook-style reading pane: body cleanup, quoted-history split, attachment tiles.
import { FileImage, FileSpreadsheet, FileText, File as FileIcon } from 'lucide-react'
import { fileKey, signedUrl } from '../../lib/fileStore'
import type { EmailAttachment } from './inboxApi'

export function kb(n: number | null): string {
  if (!n) return ''
  return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
}

export const attachmentUrl = (a: EmailAttachment, download = false) =>
  signedUrl(fileKey('booking-emails', a.s3_key), { expires: 900, download: download ? a.name : undefined })

// Plain-text bodies from Graph carry [cid:..] image refs and <http://..> link targets. Strip the noise.
export function cleanBody(raw: string | null): string {
  return (raw ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\[cid:[^\]]*\]/gi, '')
    .replace(/<(https?:|mailto:)[^>\s]*>/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Split at the first quoted-history marker so older text hides behind "..." like Outlook.
const QUOTE = /^(-{2,}\s*Original Message\s*-{2,}|_{8,}|From:\s.+\n(Sent|Date):\s|On .{6,120} wrote:\s*$)/im
export function splitQuoted(body: string): [string, string] {
  const m = QUOTE.exec(body)
  if (!m || m.index < 20) return [body, '']
  return [body.slice(0, m.index).trimEnd(), body.slice(m.index)]
}

// Signature logos ride along as attachments; Outlook hides these inline images.
export const isInlineJunk = (a: EmailAttachment) =>
  /^(image\d{3}|Outlook-[\w-]+)\.(png|jpe?g|gif)$/i.test(a.name) && (a.size ?? 0) < 120000

function tone(a: EmailAttachment): { Icon: typeof FileIcon; color: string } {
  const n = a.name.toLowerCase()
  if (n.endsWith('.pdf')) return { Icon: FileText, color: '#C4314B' }
  if (/\.(xlsx?|csv)$/.test(n)) return { Icon: FileSpreadsheet, color: '#107C41' }
  if (/\.docx?$/.test(n)) return { Icon: FileText, color: '#185ABD' }
  if (/\.(png|jpe?g|gif|webp|bmp|tiff?)$/.test(n)) return { Icon: FileImage, color: '#8764B8' }
  return { Icon: FileIcon, color: '#605E5C' }
}

export function AttachmentTiles({ items, messageId }: { items: EmailAttachment[]; messageId: number }) {
  if (!items.length) return null
  return (
    <div className="ibx-mail__atts">
      {items.map((a) => {
        const { Icon, color } = tone(a)
        return (
          <button key={a.s3_key} type="button" className="ibx-mail__att" onClick={() => inboxAction('preview', { items, index: items.indexOf(a), messageId })} title={a.name}>
            <Icon size={22} color={color} strokeWidth={1.6} />
            <span style={{ minWidth: 0 }}>
              <span className="ibx-ellip" style={{ display: 'block' }}>{a.name}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: '#605E5C' }}>{kb(a.size)}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function outlookDate(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-NZ', { weekday: 'short' })} ${d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'numeric', year: 'numeric' })} ${d.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })}`
}

// Composer and booking menu listen for these so per-email actions can drive them.
export type JobMode = 'link' | 'docs' | 'update'
export const inboxAction = (name: 'compose' | 'create-booking' | 'preview' | 'job' | 'contact' | 'ignore' | 'ea-booking' | 'create-quote' | 'quote-link', detail?: Record<string, unknown>) =>
  window.dispatchEvent(new CustomEvent(`ibx:${name}`, { detail }))
