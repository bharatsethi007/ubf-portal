import { useState } from 'react'
import { airlineLogoUrl } from './airlineLogo'

type Props = { code?: string | null; name?: string | null; size?: number }

export default function AirlineLogo({ code, name, size = 22 }: Props) {
  const [failed, setFailed] = useState(false)
  const url = airlineLogoUrl(code, name)
  if (!url || failed) return null
  return (
    <img
      src={url}
      alt={name ? `${name} logo` : 'airline logo'}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, borderRadius: 4 }}
    />
  )
}
