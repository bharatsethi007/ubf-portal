import { useEffect, useState } from 'react'
import {
  FORM_SECTIONS,
  isSectionComplete,
  type SectionKey,
} from './bookingFormValidation'
import type { BookingFormState } from '../../pages/bookings/bookingFormState'

type Props = {
  state: BookingFormState
  className?: string
}

export default function SectionNav({ state, className }: Props) {
  const [active, setActive] = useState<SectionKey>('shipment')

  useEffect(() => {
    const ids = FORM_SECTIONS.map((s) => s.key)
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target.id) {
          setActive(visible[0].target.id as SectionKey)
        }
      },
      { rootMargin: '-96px 0px -55% 0px', threshold: [0, 0.1, 0.35, 0.6] },
    )

    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  function scrollTo(key: SectionKey) {
    document.getElementById(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(key)
  }

  return (
    <nav className={`bf-nav${className ? ` ${className}` : ''}`} aria-label="Booking sections">
      <ul className="bf-nav__list">
        {FORM_SECTIONS.map(({ key, label }) => {
          const done = isSectionComplete(key, state)
          return (
            <li key={key}>
              <button
                type="button"
                className={`bf-nav__link${active === key ? ' bf-nav__link--active' : ''}`}
                onClick={() => scrollTo(key)}
              >
                <span className="bf-nav__label">{label}</span>
                {done && (
                  <span className="bf-nav__check" aria-label="Complete">
                    ✓
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
