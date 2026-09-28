import ubLogo from '../../../assets/ub-logo.jpg'

type Props = { className?: string }

/** Official UBF logo (src/assets/ub-logo.jpg). */
export default function PortalLogo({ className }: Props) {
  return (
    <img
      src={ubLogo}
      alt="UB Freight"
      className={['portal-logo', className].filter(Boolean).join(' ')}
      decoding="async"
    />
  )
}
