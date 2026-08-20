import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../supabase'

const EMOJIS = ['😞', '😐', '🙂', '😀', '🤩'] as const
const LABELS = ['Very poor', 'Poor', 'OK', 'Good', 'Excellent'] as const

function parseScore(raw: string | null): number | null {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 5) return null
  return n
}

type SubmitResult = { ok?: boolean; message?: string }

export default function RatePage() {
  const [searchParams] = useSearchParams()
  const rep = searchParams.get('rep')
  const ref = searchParams.get('ref')
  const channel = searchParams.get('c') || 'email_signature'

  const initialScore = useMemo(() => parseScore(searchParams.get('score')), [searchParams])
  const [score, setScore] = useState<number | null>(initialScore)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (score == null) {
      setError('Please choose a rating before submitting.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { data, error: rpcErr } = await supabase.rpc('csat_submit', {
        p_score: score,
        p_channel: channel || 'email_signature',
        p_comment: comment.trim() || null,
        p_staff_initials: rep?.trim() || null,
        p_booking_ref: ref?.trim() || null,
      })
      if (rpcErr) throw rpcErr
      const result = (Array.isArray(data) ? data[0] : data) as SubmitResult | null
      if (result?.ok) {
        setDone(true)
        return
      }
      setError(result?.message?.trim() || 'We could not save your rating. Please try again.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="center" style={{ minHeight: '100vh', padding: 24, background: '#f4f5f7' }}>
        <div className="card" style={{ maxWidth: 420, width: '100%', padding: '32px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🙏</div>
          <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600, color: '#0A2472' }}>Thank you</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
            Your feedback helps us improve. You may close this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="center" style={{ minHeight: '100vh', padding: 24, background: '#f4f5f7' }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', padding: '28px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.4, color: '#0A2472', marginBottom: 6 }}>UB FREIGHT</div>
          <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, color: '#0A2472' }}>How did we do?</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
            Tap a rating, add an optional comment, then submit.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {EMOJIS.map((emoji, i) => {
            const n = i + 1
            const on = score === n
            return (
              <button
                key={n}
                type="button"
                onClick={() => setScore(n)}
                title={LABELS[i]}
                aria-label={`${n} — ${LABELS[i]}`}
                style={{
                  border: on ? '2px solid #0A2472' : '2px solid var(--color-line)',
                  background: on ? '#EAEDF6' : '#fff',
                  borderRadius: 12,
                  width: 56,
                  height: 56,
                  fontSize: 26,
                  cursor: 'pointer',
                  transition: 'border-color .15s, background .15s',
                }}
              >
                {emoji}
              </button>
            )
          })}
        </div>
        {score != null && (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted-foreground)', margin: '0 0 16px' }}>
            {LABELS[score - 1]}
          </p>
        )}

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: 6 }}>
            Comment (optional)
          </span>
          <textarea
            className="input"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us what went well or what we could do better…"
            style={{ width: '100%', resize: 'vertical' }}
          />
        </label>

        {error && (
          <p style={{ color: '#B23B3B', fontSize: 13, margin: '0 0 12px', lineHeight: 1.45 }}>{error}</p>
        )}

        <button type="button" className="btn" onClick={submit} disabled={busy} style={{ width: '100%', marginTop: 0 }}>
          {busy ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
