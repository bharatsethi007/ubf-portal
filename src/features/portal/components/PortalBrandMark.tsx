type Props = {
  showName?: boolean
  className?: string
}

/** Circular blue mark + wordmark — same as portal nav. */
export default function PortalBrandMark({ showName = true, className }: Props) {
  return (
    <div className={['portal-brand-mark', className].filter(Boolean).join(' ')}>
      <span className="portal-nav__mark" aria-hidden />
      {showName && <span className="portal-nav__name">UB Freight</span>}
    </div>
  )
}
