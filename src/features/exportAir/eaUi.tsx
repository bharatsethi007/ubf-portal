import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import type { EaUrgency } from './eaTypes'

export const eaHref = (id: string) => `/bookings/export-air/${id}`

const URG: Record<EaUrgency, { dot: string; fg: string; bg: string }> = {
  overdue: { dot: '#D92D20', fg: '#B42318', bg: '#FEF3F2' },
  blocked: { dot: '#7A5AF8', fg: '#5925DC', bg: '#F4F3FF' },
  today: { dot: '#F79009', fg: '#B54708', bg: '#FFFAEB' },
  soon: { dot: '#98A2B3', fg: '#475467', bg: '#F2F4F7' },
  ok: { dot: '#17B26A', fg: '#067647', bg: '#ECFDF3' },
}

export function UrgencyDot({ u }: { u: EaUrgency }) {
  return <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: URG[u].dot }} />
}

export function DueTag({ u, due }: { u: EaUrgency; due: string | null }) {
  if (!due || u === 'ok') return null
  const d = parseISO(due)
  const label =
    u === 'blocked' ? 'Blocked'
      : u === 'overdue' ? lateLabel(d)
        : isToday(d) ? format(d, 'HH:mm')
          : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEE d')
  return (
    <span className="ml-auto shrink-0 rounded px-1.5 text-[10.5px] font-medium leading-[17px]" style={{ color: URG[u].fg, background: URG[u].bg }}>
      {label}
    </span>
  )
}

function lateLabel(d: Date) {
  const h = Math.round((Date.now() - d.getTime()) / 3_600_000)
  return h < 24 ? `${Math.max(h, 1)}h late` : `${Math.round(h / 24)}d late`
}

/** Five-segment progress: Booked, Pickup, In warehouse, SLI, Allocated. */
export function StageBar({ stage }: { stage: number }) {
  return (
    <span aria-hidden className="flex gap-[2px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="h-1 w-[18px] rounded-sm" style={{ background: i <= stage ? '#0A2472' : '#E6E8EE' }} />
      ))}
    </span>
  )
}

export function Avatar({ initials, title }: { initials: string | null; title?: string | null }) {
  return (
    <span
      title={title ?? 'Unassigned'}
      className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[9.5px] font-semibold"
      style={initials ? { background: '#EEF1F7', color: '#0A2472' } : { border: '1px dashed #D0D5DD', color: '#98A2B3' }}
    >
      {initials ?? '?'}
    </span>
  )
}

export function Code({ children, missing }: { children: ReactNode; missing?: boolean }) {
  return (
    <span
      className="bk-mono rounded px-[5px] text-[10.5px] leading-[16px]"
      style={missing ? { color: '#B54708', background: '#FFFAEB' } : { color: '#0A2472', background: '#EEF1F9' }}
    >
      {children}
    </span>
  )
}

export function Tag({ children, tone = 'grey' }: { children: ReactNode; tone?: 'grey' | 'amber' | 'red' | 'navy' | 'green' }) {
  const t = {
    grey: { color: '#475467', background: '#F2F4F7' },
    amber: { color: '#B54708', background: '#FFFAEB' },
    red: { color: '#B42318', background: '#FEF3F2' },
    navy: { color: '#0A2472', background: '#EEF1F9' },
    green: { color: '#067647', background: '#ECFDF3' },
  }[tone]
  return <span className="whitespace-nowrap rounded px-1.5 text-[10.5px] font-medium leading-[17px]" style={t}>{children}</span>
}

export function Card({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-[10px] border border-[#EEF0F3] bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F1F2F5] px-4 py-3">
        <h2 className="m-0 text-[13px] font-semibold text-[#14161A]">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  )
}

export const btn =
  'inline-flex h-[30px] w-auto items-center gap-1.5 rounded-[7px] border border-[#E3E6EB] bg-white px-3 text-[12px] font-medium text-[#14161A] hover:bg-[#F6F7F9] disabled:opacity-50'
export const btnPrimary =
  'inline-flex h-[30px] w-auto items-center gap-1.5 rounded-[7px] border border-[#0A2472] bg-[#0A2472] px-3 text-[12px] font-medium text-white hover:bg-[#081C5A] disabled:opacity-50'
export const lbl = 'text-[10.5px] uppercase tracking-[.04em] text-[#6B7280]'

export const fmtDay = (iso: string | null) => (iso ? format(parseISO(iso), 'EEE d MMM') : '—')

/** Old /bookings/EA/:id/edit links land on the new booking page. */
export function EaLegacyEditRedirect() {
  const { id } = useParams()
  return <Navigate to={id ? eaHref(id) : '/bookings/export-air'} replace />
}
