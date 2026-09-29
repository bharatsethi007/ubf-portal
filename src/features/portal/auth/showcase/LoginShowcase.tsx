import { useEffect, useState } from 'react'
import { Bell, Lock } from 'lucide-react'
import ShowcaseMap from './ShowcaseMap'
import BookStage from './BookStage'
import TrackStage from './TrackStage'
import ExecuteStage from './ExecuteStage'
import './loginShowcase.css'
import './loginShowcaseStages.css'

const STAGE_MS = 7000

const STAGES = [
  {
    step: 'Book',
    word: 'booked',
    blurb: 'Air and sea, door to door. Request a booking in under a minute.',
    toast: 'Booking 124285 confirmed',
    toastSub: 'Auckland → Suva · 1 × 40HQ',
    View: BookStage,
  },
  {
    step: 'Track',
    word: 'tracked',
    blurb: 'Live vessel positions, milestones and ETAs, updated as it moves.',
    toast: 'Departed Auckland',
    toastSub: '124285 · on schedule for 12 Oct',
    View: TrackStage,
  },
  {
    step: 'Deliver',
    word: 'delivered',
    blurb: 'Bills of lading, customs, PODs and invoices, ready the moment they are.',
    toast: 'Delivered to consignee',
    toastSub: '124285 · POD signed, invoice ready',
    View: ExecuteStage,
  },
] as const

/** Right-hand brand panel on the portal login: animated book → track → deliver tour. */
export default function LoginShowcase() {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const t = window.setTimeout(() => setStage((s) => (s + 1) % STAGES.length), STAGE_MS)
    return () => window.clearTimeout(t)
  }, [stage])

  const cur = STAGES[stage]
  const View = cur.View

  return (
    <aside className="ls-panel" aria-label="What you can do in the UB Freight portal">
      <ShowcaseMap />
      <div className="ls-vignette" />

      <div className="ls-content">
        <header className="ls-hero">
          <span className="ls-chip"><span className="ls-live" />Customer portal</span>
          <h2 className="ls-headline">
            Your freight,
            <span className="ls-word-wrap">
              <span key={cur.word} className="ls-word">{cur.word}.</span>
            </span>
          </h2>
          <p key={cur.blurb} className="ls-blurb">{cur.blurb}</p>
        </header>

        <div className="ls-stagebox">
          <div className="ls-window">
            <div className="ls-window__bar">
              <span className="ls-window__dots"><i /><i /><i /></span>
              <span className="ls-window__url"><Lock size={10} />portal.ubfreight.com</span>
            </div>
            <div key={stage} className="ls-window__body">
              <View />
            </div>
          </div>

          <div key={`t${stage}`} className="ls-toast">
            <span className="ls-toast__icon"><Bell size={14} /></span>
            <span>
              <span className="ls-toast__title">{cur.toast}</span>
              <span className="ls-toast__sub">{cur.toastSub}</span>
            </span>
          </div>
        </div>

        <nav className="ls-steps">
          {STAGES.map((s, i) => (
            <button
              key={s.step}
              type="button"
              className={`ls-step${i === stage ? ' ls-step--on' : ''}${i < stage ? ' ls-step--past' : ''}`}
              onClick={() => setStage(i)}
            >
              <span className="ls-step__bar">
                <span
                  key={`${stage}-${i}`}
                  className="ls-step__fill"
                  style={{ animationDuration: `${STAGE_MS}ms` }}
                />
              </span>
              <span className="ls-step__num">0{i + 1}</span>
              <span className="ls-step__label">{s.step}</span>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  )
}
