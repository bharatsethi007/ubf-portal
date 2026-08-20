import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../supabase'
import './shipmentCsatWidget.css'

type TokenResult = {
  ok?: boolean
  token?: string
  prior_score?: number | null
  message?: string
}

type SubmitResult = {
  ok?: boolean
  message?: string
}

function unwrapRpc<T>(data: unknown): T | null {
  if (data == null) return null
  return (Array.isArray(data) ? data[0] : data) as T
}

type Props = {
  bookingId: string
}

export default function ShipmentCsatWidget({ bookingId }: Props) {
  const [token, setToken] = useState<string | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [confirmedScore, setConfirmedScore] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const { data, error } = await supabase.rpc('csat_portal_request_token', {
        p_booking_id: bookingId,
      })
      if (cancelled) return
      if (error) return

      const result = unwrapRpc<TokenResult>(data)
      if (!result?.ok || !result.token) return

      setToken(result.token)
      if (result.prior_score != null) {
        setScore(result.prior_score)
        setConfirmedScore(result.prior_score)
        setEditing(false)
      } else {
        setEditing(true)
      }
    })()

    return () => { cancelled = true }
  }, [bookingId])

  if (!token) return null

  const showingForm = editing || confirmedScore == null

  async function submit() {
    if (score == null || !token) return
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('csat_submit', {
        p_score: score,
        p_token: token,
        p_comment: comment.trim() || null,
      })
      if (error) throw error
      const result = unwrapRpc<SubmitResult>(data)
      if (!result?.ok) {
        toast.error(result?.message?.trim() || 'We could not save your rating. Please try again.')
        return
      }
      setConfirmedScore(score)
      setEditing(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="portal-card portal-card--pad" style={{ marginBottom: 16 }}>
      {!showingForm && confirmedScore != null ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px' }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--portal-ink)' }}>
            Thanks — you rated {confirmedScore}★
          </p>
          <button
            type="button"
            className="portal-csat-edit"
            onClick={() => setEditing(true)}
          >
            Edit your rating
          </button>
        </div>
      ) : (
        <>
          <h2 className="portal-card-title" style={{ marginBottom: 6 }}>How was this shipment?</h2>
          <p className="portal-card-meta" style={{ marginBottom: 16 }}>
            Your feedback helps us improve our service.
          </p>

          <div className="portal-csat-stars" role="radiogroup" aria-label="Shipment rating">
            {[1, 2, 3, 4, 5].map((n) => {
              const on = score != null && n <= score
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={score === n}
                  aria-label={`${n} star${n === 1 ? '' : 's'}`}
                  className={`portal-csat-star${on ? ' portal-csat-star--on' : ''}`}
                  onClick={() => setScore(n)}
                >
                  <Star size={22} strokeWidth={1.75} fill={on ? 'currentColor' : 'none'} />
                </button>
              )
            })}
          </div>

          {confirmedScore != null && (
            <button
              type="button"
              className="portal-csat-edit"
              style={{ marginBottom: 12 }}
              onClick={() => { setScore(confirmedScore); setEditing(false) }}
            >
              Cancel edit
            </button>
          )}

          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--portal-muted)', marginBottom: 6 }}>
              Comment (optional)
            </span>
            <textarea
              className="portal-login__input"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us what went well or what we could do better…"
              style={{ width: '100%', resize: 'vertical', minHeight: 72 }}
            />
          </label>

          <button
            type="button"
            className="portal-btn-primary"
            onClick={submit}
            disabled={busy || score == null}
          >
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        </>
      )}
    </div>
  )
}
