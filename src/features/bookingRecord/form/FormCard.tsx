type Props = {
  title: string
  children: React.ReactNode
  className?: string
}

export default function FormCard({ title, children, className }: Props) {
  return (
    <section className={`card booking-form-card${className ? ` ${className}` : ''}`}>
      <h3 className="booking-form-card__title">{title}</h3>
      <div className="booking-form-card__body">{children}</div>
    </section>
  )
}
