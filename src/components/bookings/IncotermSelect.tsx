import { AIR_INCOTERM_CODES, INCOTERMS_2020 } from '../../data/incoterms2020'
import './incotermSelect.css'

type Props = {
  value: string
  onChange: (code: string) => void
  // When true, restrict to the seven air-valid Incoterms (drops FAS/FOB/CFR/CIF).
  airOnly?: boolean
}

export default function IncotermSelect({ value, onChange, airOnly = false }: Props) {
  const options = airOnly
    ? INCOTERMS_2020.filter((t) => (AIR_INCOTERM_CODES as readonly string[]).includes(t.code))
    : INCOTERMS_2020

  return (
    <select
      className="incoterm-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— Select incoterm —</option>
      {options.map(({ code, name }) => (
        <option key={code} value={code}>
          {code} – {name}
        </option>
      ))}
    </select>
  )
}
