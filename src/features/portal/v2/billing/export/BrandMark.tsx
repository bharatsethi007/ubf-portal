import { useState } from 'react'
import './accountingExport.css'

export type Brand = 'xero' | 'myob'

export const BRAND = {
  xero: { name: 'Xero', color: '#13B5EA', logo: '/brands/xero.svg' },
  myob: { name: 'MYOB', color: '#6100A5', logo: '/brands/myob.svg' },
} as const

/** Official logo from /public/brands when present, otherwise a coloured name badge. */
export default function BrandMark({ brand }: { brand: Brand }) {
  const m = BRAND[brand]
  const [ok, setOk] = useState(true)
  return ok
    ? <img src={m.logo} alt="" className="pv3-brandmark" onError={() => setOk(false)} />
    : <span className="pv3-brandmark pv3-brandmark--badge" style={{ background: m.color }} aria-hidden>{m.name}</span>
}
