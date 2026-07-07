import ubLogo from '../../../assets/ub-logo.jpg'
import ubLogoLight from '../../../assets/ub-logo-light.png'

type Props = {
  /** White/orange on transparent — for navy login panel */
  variant?: 'default' | 'light'
  className?: string
}

/**
 * UBF logo from src/assets/ub-logo.jpg (white JPG bg blends on white nav).
 * Light variant uses ub-logo-light.png for dark backgrounds.
 */
export default function PortalLogo({ variant = 'default', className }: Props) {
  const src = variant === 'light' ? ubLogoLight : ubLogo
  return (
    <img
      src={src}
      alt="UB Freight"
      className={['portal-logo', variant === 'light' ? 'portal-logo--light' : '', className]
        .filter(Boolean)
        .join(' ')}
      decoding="async"
    />
  )
}
