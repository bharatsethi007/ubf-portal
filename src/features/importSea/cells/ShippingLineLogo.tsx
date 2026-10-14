import { useState } from 'react'
import { resolveShippingLine, shippingLineLogoSources } from '../shippingLineLogo'

type Props = { name?: string | null; size?: number }

// Logo only. Full line name on hover. Unknown line or no image: short text fallback.
export default function ShippingLineLogo({ name, size = 20 }: Props) {
  const raw = name?.trim() ?? ''
  const info = resolveShippingLine(raw)
  const sources = info ? shippingLineLogoSources(info) : []
  const [idx, setIdx] = useState(0)

  if (!raw) return <span className="muted">–</span>

  if (!info || idx >= sources.length) {
    return (
      <span title={raw} className="text-[11px] text-muted-foreground truncate inline-block max-w-[64px] align-middle">
        {info?.label ?? raw}
      </span>
    )
  }

  return (
    <img
      src={sources[idx]}
      alt={info.label}
      title={raw}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setIdx((i) => i + 1)}
      className="inline-block align-middle rounded-[3px]"
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  )
}
