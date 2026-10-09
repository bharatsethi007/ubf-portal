import { useEffect, useState } from 'react'
import { Check, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { buildClearanceAdvice } from '@/features/customsAdvice/renderClearanceAdvice'
import ClearanceAdviceDialog from '@/features/customsAdvice/ClearanceAdviceDialog'
import { formatReleaseTimestamp } from '@/features/clearance/clearanceLayers'
import { fetchBookingCustoms, type BookingCustoms } from '@/features/importSea/importSeaCustoms'

type Line = { label: string; done: boolean; warn: boolean; value: string; tip: string }

function latest(...vals: Array<string | null | undefined>): string | null {
  const v = vals.filter(Boolean).sort() as string[]
  return v[v.length - 1] ?? null
}

function customsLine(c: BookingCustoms): Line {
  const entry = c.entry_number ? `Entry ${c.entry_number}` : 'Entry not lodged'
  const done = Boolean(c.customs_released_at)
  const warn = c.customs_status === '822' || c.customs_status === '814'
  const state = done
    ? formatReleaseTimestamp(c.customs_released_at ?? null)
    : warn ? (c.customs_status === '814' ? 'Cancelled' : 'Cash to pay') : 'Awaiting'
  return {
    label: 'UBF Customs cleared', done, warn,
    value: `${entry} · ${state}`,
    tip: c.customs_status_label ?? 'No Customs response yet',
  }
}

function mpiLine(c: BookingCustoms): Line {
  const bioOk = Boolean(c.mpi_bio_cleared_at)
  const foodOk = Boolean(c.mpi_food_cleared_at) || !c.mpi_food_status
  const done = bioOk && foodOk
  const warn = !done && (c.mpi_status === 'B05' || c.mpi_food_status === 'F05')
  const ref = c.bacc_number ? `BACC ${c.bacc_number}`
    : c.facc_number ? `FACC ${c.facc_number}`
      : c.entry_number ? `Entry ${c.entry_number}` : 'No entry'
  const state = done
    ? formatReleaseTimestamp(latest(c.mpi_bio_cleared_at, c.mpi_food_cleared_at))
    : warn ? 'Directions given' : 'Awaiting'
  const tip = [c.mpi_status_label, c.mpi_food_status_label, c.facc_number && c.bacc_number ? `FACC ${c.facc_number}` : null]
    .filter(Boolean).join(' · ') || 'No MPI response yet'
  return { label: 'UBF MPI cleared', done, warn, value: `${ref} · ${state}`, tip }
}

/**
 * UBF's own customs entry (CyberFreight / TSW). Returns null when the job has no
 * CF entry, so the caller can fall back to the manual "UBF cleared" switch.
 */
export function useBookingCustoms(bookingId: string) {
  const [data, setData] = useState<BookingCustoms | null | undefined>(undefined)
  useEffect(() => {
    let off = false
    fetchBookingCustoms(bookingId)
      .then((m) => { if (!off) setData(m.get(bookingId) ?? null) })
      .catch(() => { if (!off) setData(null) })
    return () => { off = true }
  }, [bookingId])
  return data
}

type Props = { customs: BookingCustoms; bookingId: string; bookingRef: string | null }

export default function UbfClearanceMilestones({ customs, bookingId, bookingRef }: Props) {
  const lines = [customsLine(customs), mpiLine(customs)]
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])

  async function open() {
    setBusy(true)
    try {
      setPreview(await buildClearanceAdvice(bookingId, bookingRef))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not build clearance advice')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {lines.map((l) => (
        <li key={l.label} className={`booking-milestones__row${l.warn ? ' booking-milestones__row--warn' : ''}`} title={l.tip}>
          <span className="booking-milestones__label">
            {l.label}
            {l.done ? <Check size={13} style={{ color: '#12B76A' }} /> : null}
          </span>
          <span className="booking-port-status__value">
            <span className="tabular-nums">{l.value}</span>
            <span
              className="booking-container-source-dot booking-container-source-dot--erp"
              title="From CyberFreight (TSW)"
              aria-label="From CyberFreight"
            />
          </span>
        </li>
      ))}
      <li className="booking-milestones__row">
        <span className="booking-milestones__label">Clearance advice (PDF)</span>
        <button
          type="button"
          className="icon-btn"
          onClick={open}
          disabled={busy}
          title="View UBF clearance advice: Customs entry + MPI"
          aria-label="View clearance advice PDF"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
        </button>
        <ClearanceAdviceDialog url={preview?.url ?? null} title={preview?.title ?? ''} onClose={() => setPreview(null)} />
      </li>
    </>
  )
}
