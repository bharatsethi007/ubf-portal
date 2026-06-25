import { Fragment, useEffect, useState } from 'react'
import type { BookingFormState } from '../../pages/bookings/bookingFormState'
import {
  FORM_SECTIONS,
  isSectionComplete,
  type SectionKey,
} from './bookingFormValidation'
import './topProgressBar.css'

type Props = {
  state: BookingFormState
}

export default function TopProgressBar({ state }: Props) {
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
      { rootMargin: '-132px 0px -55% 0px', threshold: [0, 0.1, 0.35, 0.6] },
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
    <nav className="top-progress" aria-label="Booking progress">
      <div className="top-progress__scroll">
        <div className="top-progress__row">
          {FORM_SECTIONS.map(({ key, label }, index) => {
            const done = isSectionComplete(key, state)
            const isActive = active === key
            const prevDone = index > 0 && isSectionComplete(FORM_SECTIONS[index - 1].key, state)
            const connectorDone = index > 0 && prevDone && done

            return (
              <Fragment key={key}>
                {index > 0 && (
                  <span
                    className={`top-progress__connector${connectorDone ? ' top-progress__connector--done' : ''}`}
                    aria-hidden
                  />
                )}
                <button
                  type="button"
                  className={[
                    'top-progress__step',
                    done ? 'top-progress__step--done' : '',
                    isActive ? 'top-progress__step--active' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => scrollTo(key)}
                >
                  <span className="top-progress__circle" aria-hidden>
                    {isActive ? index + 1 : done ? '✓' : index + 1}
                  </span>
                  <span className="top-progress__label">{label}</span>
                </button>
              </Fragment>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
