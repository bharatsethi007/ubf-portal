import { toast } from 'sonner'
import { supabase } from '../../../supabase'
import type { NoteField } from './meetingsApi'

export type ShareChannel = 'whatsapp' | 'email' | 'native'

type ShareData = {
  agentName: string
  discussion: string
  photoUrls: string[]
  phone: string | null
  email: string | null
}

type NavShareData = { title?: string; text?: string; files?: File[] }
type NavShare = Navigator & {
  canShare?: (data?: NavShareData) => boolean
  share?: (data: NavShareData) => Promise<void>
}

function discussionFrom(notesFields: unknown, notes: string | null): string {
  if (Array.isArray(notesFields)) {
    const d = notesFields.find(
      (f) =>
        f &&
        typeof f === 'object' &&
        String((f as NoteField).label ?? '').trim().toLowerCase() === 'discussion',
    ) as NoteField | undefined
    if (d?.value?.trim()) return d.value.trim()
  }
  return (notes ?? '').trim()
}

function toDigits(s: string | null): string | null {
  if (!s) return null
  const d = s.replace(/[^\d]/g, '')
  return d || null
}

export async function fetchMeetingShare(meetingId: string): Promise<ShareData> {
  const { data: m, error } = await supabase
    .from('conference_meetings')
    .select(
      'notes_fields, notes, contact_name, contact_email, contact_phone, agent_id, manual_agent_name, agents(name)',
    )
    .eq('id', meetingId)
    .maybeSingle()
  if (error) throw error

  const { data: photos } = await supabase
    .from('meeting_photos')
    .select('image_url, sort_order')
    .eq('meeting_id', meetingId)
    .order('sort_order', { ascending: true })

  let phone: string | null = m?.contact_phone ?? null
  let email: string | null = m?.contact_email ?? null
  if ((!phone || !email) && m?.agent_id) {
    const { data: contacts } = await supabase
      .from('agent_contacts')
      .select('phone, email, created_at')
      .eq('agent_id', m.agent_id)
      .order('created_at', { ascending: true })
    for (const c of contacts ?? []) {
      if (!phone && c.phone) phone = c.phone as string
      if (!email && c.email) email = c.email as string
    }
  }

  const agentName =
    (m?.agents as { name?: string } | null)?.name ??
    m?.contact_name ??
    m?.manual_agent_name ??
    'Agent'

  return {
    agentName,
    discussion: discussionFrom(m?.notes_fields, (m?.notes as string | null) ?? null),
    photoUrls: (photos ?? []).map((p) => p.image_url as string).filter(Boolean),
    phone: toDigits(phone),
    email,
  }
}

function buildText(d: ShareData, withPhotoLinks: boolean): string {
  const parts = [`Meeting notes — ${d.agentName}`, '', d.discussion || '(no discussion recorded)']
  if (withPhotoLinks && d.photoUrls.length) parts.push('', 'Photos:', ...d.photoUrls)
  return parts.join('\n')
}

async function urlsToFiles(urls: string[]): Promise<File[]> {
  const files: File[] = []
  for (let i = 0; i < urls.length; i++) {
    try {
      const res = await fetch(urls[i])
      if (!res.ok) continue
      const blob = await res.blob()
      const ext = (blob.type.split('/')[1] || 'jpg').split(';')[0]
      files.push(new File([blob], `card-${i + 1}.${ext}`, { type: blob.type || 'image/jpeg' }))
    } catch {
      // skip an unreachable image
    }
  }
  return files
}

export async function shareMeeting(meetingId: string, channel: ShareChannel): Promise<void> {
  let d: ShareData
  try {
    d = await fetchMeetingShare(meetingId)
  } catch {
    toast.error('Could not load meeting to share')
    return
  }

  const nav = navigator as NavShare

  // Native share with the actual photos attached — best on a phone.
  if (channel !== 'email' && d.photoUrls.length && typeof nav.share === 'function') {
    const files = await urlsToFiles(d.photoUrls)
    if (files.length && nav.canShare?.({ files })) {
      try {
        await nav.share({ title: `Meeting — ${d.agentName}`, text: buildText(d, false), files })
      } catch {
        // user cancelled — nothing to do
      }
      return
    }
  }

  // Native share (text only) when explicitly asked and no attachable photos.
  if (channel === 'native' && typeof nav.share === 'function') {
    try {
      await nav.share({ title: `Meeting — ${d.agentName}`, text: buildText(d, true) })
    } catch {
      // cancelled
    }
    return
  }

  if (channel === 'whatsapp' || channel === 'native') {
    const text = encodeURIComponent(buildText(d, true))
    const base = d.phone ? `https://wa.me/${d.phone}` : 'https://wa.me/'
    window.open(`${base}?text=${text}`, '_blank')
    return
  }

  // email
  if (!d.email) toast.info('No email on file for this agent — add a recipient in your mail app')
  const subject = encodeURIComponent(`Meeting notes — ${d.agentName}`)
  const body = encodeURIComponent(buildText(d, true))
  window.location.href = `mailto:${d.email ?? ''}?subject=${subject}&body=${body}`
}
