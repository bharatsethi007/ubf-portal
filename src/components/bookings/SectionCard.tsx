import type { ReactNode } from 'react'

type Props = {
  id: string
  title?: string
  bare?: boolean
  children: ReactNode
}

export function SectionCard({ id, title, bare, children }: Props) {
  return (
    <section id={id} className="bf-section">
      {!bare && title && (
        <header className="bf-section__head">
          <h2 className="bf-section__title">{title}</h2>
        </header>
      )}
      <div className="bf-section__body">{children}</div>
    </section>
  )
}
