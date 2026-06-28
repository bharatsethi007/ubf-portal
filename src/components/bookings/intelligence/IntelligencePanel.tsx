import { useEffect, useState } from 'react'
import IntelligenceDetail from './IntelligenceDetail'
import IntelligenceParty from './IntelligenceParty'
import { openConfirmationDraft } from './confirmationMail'
import { THINKING_LINES } from './intelligenceUtils'
import type { ConfirmationDraftContext, IntelligenceJob, IntelligencePanelData } from './types'

type Phase = 'thinking' | 'insights' | 'detail'

type Props = {
  data: IntelligencePanelData
  loading: boolean
  contentKey: string
  getDraftContext: () => ConfirmationDraftContext | null
  onClose: () => void
}

export default function IntelligencePanel({
  data,
  loading,
  contentKey,
  getDraftContext,
  onClose,
}: Props) {
  const [phase, setPhase] = useState<Phase>('thinking')
  const [step, setStep] = useState(0)
  const [job, setJob] = useState<IntelligenceJob | null>(null)

  useEffect(() => {
    setPhase('thinking')
    setStep(0)
    setJob(null)
  }, [contentKey])

  useEffect(() => {
    if (phase !== 'thinking' || !loading) return
    if (step < THINKING_LINES.length - 1) {
      const t = window.setTimeout(() => setStep((s) => s + 1), 650)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [phase, step, loading])

  useEffect(() => {
    if (loading) return
    setPhase('insights')
  }, [loading, contentKey])

  const noteWithCta = data.notes?.find((n) => n.cta)

  return (
    <div className="intel-panel ai-glow">
      <div className="intel-panel__inner">
        <div className="intel-panel__head">
          <div className="intel-panel__brand">
            <div className="intel-panel__mark">✦</div>
            <h3 className="intel-panel__title">UBF Intelligence</h3>
          </div>
          <button type="button" className="intel-panel__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {phase === 'thinking' && (
          <div className="intel-thinking">
            {THINKING_LINES.slice(0, step + 1).map((line, i) => (
              <div
                key={line}
                className={`intel-thinking__line${i === step ? ' intel-thinking__line--active' : ''}`}
              >
                {i < step && <span className="intel-thinking__check">✓</span>}
                {line}
              </div>
            ))}
          </div>
        )}

        {phase === 'insights' && (
          <div className="intel-insights">
            {data.supplier && (
              <IntelligenceParty
                role="Supplier"
                party={data.supplier}
                onPick={(picked) => {
                  setJob(picked)
                  setPhase('detail')
                }}
              />
            )}
            {data.consignee && (
              <IntelligenceParty
                role="Consignee"
                party={data.consignee}
                onPick={(picked) => {
                  setJob(picked)
                  setPhase('detail')
                }}
              />
            )}
            {data.notes?.length ? (
              <div className="intel-notes">
                <div className="intel-notes__label">Notes</div>
                <ul className="intel-notes__list">
                  {data.notes.map((note) => (
                    <li key={note.text} className="intel-notes__item">
                      <span className="intel-notes__dot">●</span>
                      <span>{note.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {noteWithCta?.cta && (
              <button
                type="button"
                className="intel-cta intel-cta--link"
                onClick={() => {
                  const ctx = getDraftContext()
                  if (ctx) openConfirmationDraft(ctx)
                }}
              >
                {noteWithCta.cta.label}
              </button>
            )}
          </div>
        )}

        {phase === 'detail' && job && (
          <IntelligenceDetail job={job} onBack={() => setPhase('insights')} />
        )}
      </div>
    </div>
  )
}
