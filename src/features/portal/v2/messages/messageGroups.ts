import type { Message } from './messagesApi'

export type Group = { key: string; mine: boolean; staff: boolean; name: string | null; breakLabel: string | null; items: Message[] }

const GAP_MS = 15 * 60 * 1000

/** "Today 1:00 pm", "Yesterday 9:12 am", "Mon 3:40 pm", "12 Sep 10:05 am". */
export function breakLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const time = d.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5)
  if (days <= 0) return `Today ${time}`
  if (days === 1) return `Yesterday ${time}`
  if (days < 7) return `${d.toLocaleDateString('en-NZ', { weekday: 'long' })} ${time}`
  return `${d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })} ${time}`
}

function who(m: Message): string | null {
  if (m.mine) return null
  if (m.kind === 'staff') return m.name ? m.name.split(/\s+/)[0] : ''
  return m.name
}

/** Runs of messages from the same sender, split by 15-minute gaps. A time break opens each gap. */
export function groupMessages(msgs: Message[]): Group[] {
  const out: Group[] = []
  let prev: Message | null = null
  for (const m of msgs) {
    const gap = !prev || Date.parse(m.at) - Date.parse(prev.at) > GAP_MS
    const sameSender = prev && prev.mine === m.mine && prev.kind === m.kind && prev.name === m.name
    if (gap || !sameSender || !out.length) {
      out.push({ key: `${m.id}`, mine: m.mine, staff: m.kind === 'staff', name: who(m), breakLabel: gap ? breakLabel(m.at) : null, items: [m] })
    } else {
      out[out.length - 1].items.push(m)
    }
    prev = m
  }
  return out
}
