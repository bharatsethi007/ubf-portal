import { NavLink } from 'react-router-dom'
import { WORKSPACE_MODES } from './bookingModes'
import type { ModeCounts } from './useBookingModeCounts'

type Props = { counts: ModeCounts }

/** Segmented mode switcher: Import Sea / Import Air / Export Sea / Export Air. */
export default function BookingModeTabs({ counts }: Props) {
  return (
    <nav aria-label="Booking mode" className="bk-seg">
      {WORKSPACE_MODES.map(({ slug, module, label, icon: Icon }) => {
        const c = counts[module]
        return (
          <NavLink key={slug} to={`/bookings/${slug}`} className={({ isActive }) => `bk-seg__btn${isActive ? ' bk-seg__btn--on' : ''}`}>
            <Icon size={14} strokeWidth={1.8} />
            <span>{label}</span>
            {c && c.open > 0 ? <span className="bk-seg__n">{c.open}</span> : null}
            {c && c.overdue > 0 ? (
              <span className="bk-seg__late" title={`${c.overdue} overdue or on hold`}>{c.overdue}</span>
            ) : null}
          </NavLink>
        )
      })}
    </nav>
  )
}
