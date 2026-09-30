import { useState } from 'react'
import './accountingExport.css'

type Props = { brand: 'xero' | 'myob'; onClick: () => void; disabled?: boolean }

const META = {
  xero: { name: 'Xero', color: '#13B5EA', logo: '/brands/xero.svg' },
  myob: { name: 'MYOB', color: '#6100A5', logo: '/brands/myob.svg' },
} as const

/**
 * "Export for Xero / MYOB" button. Uses the official logo file from /public/brands when present,
 * otherwise a plain coloured badge with the name.
 */
export default function BrandButton({ brand, onClick, disabled }: Props) {
  const m = META[brand]
  const [logoOk, setLogoOk] = useState(true)
  return (
    <button type="button" className="pv3-brandbtn" style={{ ['--brand' as string]: m.color }} onClick={onClick} disabled={disabled}
      title={`Download a bills file for ${m.name}`}>
      {logoOk
        ? <img src={m.logo} alt="" className="pv3-brandbtn__logo" onError={() => setLogoOk(false)} />
        : <span className="pv3-brandbtn__badge" aria-hidden>{m.name}</span>}
      <span>Export to {m.name}</span>
    </button>
  )
}
