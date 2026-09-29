import { Anchor, Check, Ship } from 'lucide-react'

const MILESTONES = [
  { label: 'Booking confirmed', when: '29 Sep' },
  { label: 'Container picked up', when: '06 Oct' },
  { label: 'Departed Auckland', when: '07 Oct' },
]

/** Stage 2 — live shipment card: vessel moves, milestones tick, ETA counts down. */
export default function TrackStage() {
  return (
    <div className="ls-stage">
      <div className="ls-stage__head">
        <div>
          <p className="ls-eyebrow">Shipment</p>
          <p className="ls-title ls-title--blue">124285</p>
        </div>
        <span className="ls-pill ls-pill--transit">In transit</span>
      </div>

      <div className="ls-track">
        <div className="ls-track__ends">
          <span><span className="fi fi-nz ls-flag" />Auckland</span>
          <span>Suva<span className="fi fi-fj ls-flag ls-flag--r" /></span>
        </div>
        <div className="ls-track__bar">
          <span className="ls-track__fill" />
          <span className="ls-track__ship"><Ship size={14} /></span>
          <span className="ls-track__pin ls-track__pin--a" />
          <span className="ls-track__pin ls-track__pin--b"><Anchor size={10} /></span>
        </div>
      </div>

      <div className="ls-eta">
        <div>
          <p className="ls-eta__label">Estimated arrival</p>
          <p className="ls-eta__date">Sun 12 Oct</p>
        </div>
        <div className="ls-eta__count">
          <span className="ls-roll"><span>3</span><span>2</span></span>
          <span className="ls-eta__unit">days</span>
        </div>
      </div>

      <ul className="ls-miles">
        {MILESTONES.map((m, i) => (
          <li key={m.label} className="ls-mile" style={{ ['--d' as string]: `${0.6 + i * 0.7}s` }}>
            <span className="ls-mile__dot"><Check size={10} strokeWidth={3} /></span>
            <span className="ls-mile__label">{m.label}</span>
            <span className="ls-mile__when">{m.when}</span>
          </li>
        ))}
        <li className="ls-mile ls-mile--next" style={{ ['--d' as string]: '2.7s' }}>
          <span className="ls-mile__dot ls-mile__dot--pulse" />
          <span className="ls-mile__label">Arriving Suva</span>
          <span className="ls-mile__when">12 Oct</span>
        </li>
      </ul>
    </div>
  )
}
