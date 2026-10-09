import type { AdviceEntry, AdviceResponse } from './clearanceAdviceApi'

const NZ = 'Pacific/Auckland'

export function nzDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-NZ', {
    timeZone: NZ, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function nzShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-NZ', {
    timeZone: NZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  })
}

export function nzDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NZ', { timeZone: NZ, day: 'numeric', month: 'short', year: 'numeric' })
}

export function money(n: number | null | undefined): string {
  if (n == null) return '—'
  return `NZD ${n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function qty(n: number | null | undefined, unit: string): string {
  if (n == null) return '—'
  return `${n.toLocaleString('en-NZ', { maximumFractionDigits: 3 })} ${unit}`
}

export const dash = (v: string | null | undefined) => (v && v.trim() ? v : '—')

/** "BACC_B2026_285408.pdf" -> "BACC B2026/285408". Skips the _xml.txt twin. */
export function docRefs(r: AdviceResponse): string[] {
  const out: string[] = []
  for (const a of r.attachments ?? []) {
    const m = /^(BACC|FACC)_([A-Z]\d{4})_(\d+)/i.exec(a.filename ?? '')
    if (m && !(a.filename ?? '').toLowerCase().endsWith('.txt')) {
      const ref = `${m[1].toUpperCase()} ${m[2].toUpperCase()}/${m[3]}`
      if (!out.includes(ref)) out.push(ref)
    }
  }
  return out
}

export type TimelineRow = { at: string; code: string; text: string }

/** Responses for one side of the advice. Customs = TSW + NZCS, MPI = MPIBIO + MPIFOOD. */
export function timeline(responses: AdviceResponse[], side: 'customs' | 'mpi', labels: Record<string, string>): TimelineRow[] {
  const agencies = side === 'customs' ? ['TSW', 'NZCS'] : ['MPIBIO', 'MPIFOOD']
  return responses
    .filter((r) => agencies.includes(r.agency ?? ''))
    .map((r) => {
      const label = (r.status && labels[r.status]) || r.note || ''
      const refs = docRefs(r)
      const stmt = r.statement && !/refer to attached/i.test(r.statement) ? r.statement : ''
      const text = [label, stmt, refs.length ? refs.join(', ') : ''].filter(Boolean).join(' · ')
      const who = r.agency === 'MPIBIO' ? 'Bio ' : r.agency === 'MPIFOOD' ? 'Food ' : ''
      return { at: nzShort(r.release_at ?? r.received_at), code: `${who}${r.status ?? ''}`.trim(), text }
    })
}

export type BadgeTone = 'ok' | 'warn' | 'wait'

export function customsBadge(e: AdviceEntry): { text: string; tone: BadgeTone } {
  if (e.customs_released_at) return { text: 'Released', tone: 'ok' }
  if (e.customs_status === '822') return { text: 'Cash to pay', tone: 'warn' }
  if (e.customs_status === '814') return { text: 'Cancelled', tone: 'warn' }
  return { text: 'Awaiting release', tone: 'wait' }
}

export function bioBadge(e: AdviceEntry): { text: string; tone: BadgeTone } {
  if (e.mpi_bio_cleared_at) return { text: `Cleared ${nzShort(e.mpi_bio_cleared_at)}`, tone: 'ok' }
  if (e.mpi_status === 'B05') return { text: 'Directions given', tone: 'warn' }
  return { text: e.mpi_status ? 'Awaiting MPI' : 'No response', tone: 'wait' }
}

export function foodBadge(e: AdviceEntry): { text: string; tone: BadgeTone } {
  if (e.mpi_food_cleared_at) return { text: `Cleared ${nzShort(e.mpi_food_cleared_at)}`, tone: 'ok' }
  if (e.mpi_food_status === 'F05') return { text: 'Directions given', tone: 'warn' }
  return { text: e.mpi_food_status ? 'Awaiting MPI' : 'Not required', tone: 'wait' }
}

export function mpiOverall(e: AdviceEntry): { text: string; tone: BadgeTone } {
  const b = bioBadge(e)
  const f = foodBadge(e)
  if (b.tone === 'warn' || f.tone === 'warn') return { text: 'Directions given', tone: 'warn' }
  if (b.tone === 'ok' && (f.tone === 'ok' || f.text === 'Not required')) return { text: 'Cleared', tone: 'ok' }
  return { text: 'Awaiting MPI', tone: 'wait' }
}
