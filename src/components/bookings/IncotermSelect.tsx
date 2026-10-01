import { AIR_INCOTERM_CODES, INCOTERMS_2020, LEGACY_INCOTERMS } from '../../data/incoterms2020'
import './incotermSelect.css'

type Props = {
  value: string
  onChange: (code: string) => void
  className?: string
  /** Air quotes list the any-mode terms first; sea-only terms stay available below. */
  airOnly?: boolean
}

const ANY_MODE = INCOTERMS_2020.filter((t) => (AIR_INCOTERM_CODES as readonly string[]).includes(t.code))
const SEA_ONLY = INCOTERMS_2020.filter((t) => !(AIR_INCOTERM_CODES as readonly string[]).includes(t.code))

export default function IncotermSelect({ value, onChange, className = 'incoterm-select', airOnly = false }: Props) {
  const known = [...INCOTERMS_2020, ...LEGACY_INCOTERMS].some((t) => t.code === value)
  const opt = ({ code, name }: { code: string; name: string }) => (
    <option key={code} value={code}>{code} – {name}</option>
  )

  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Select incoterm —</option>
      {value && !known ? <option value={value}>{value}</option> : null}
      <optgroup label="Any mode">{ANY_MODE.map(opt)}</optgroup>
      <optgroup label={airOnly ? 'Sea terms (also used on air)' : 'Sea and inland waterway'}>{SEA_ONLY.map(opt)}</optgroup>
      <optgroup label="Legacy">{LEGACY_INCOTERMS.map(opt)}</optgroup>
    </select>
  )
}
