import { useState } from 'react'
import { airlineLogoSources } from './airlineLogo'

type Props = { code?: string | null; name?: string | null; size?: number }

export default function AirlineLogo({ code, name, size = 22 }: Props) {
  const sources = airlineLogoSources(code, name)
  const [idx, setIdx] = useState(0)
  if (idx >= sources.length) return null
  return (
    <img
      src={sources[idx]}
      alt={name ? `${name} logo` : 'airline logo'}
      width={size}
      height={size}
      onError={() => setIdx((i) => i + 1)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, borderRadius: 4 }}
    />
  )
}
