import { INCOTERMS_2020 } from '../../data/incoterms2020'
import './incotermSelect.css'

type Props = {
  value: string
  onChange: (code: string) => void
}

export default function IncotermSelect({ value, onChange }: Props) {
  return (
    <select
      className="incoterm-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {INCOTERMS_2020.map(({ code, name }) => (
        <option key={code} value={code}>
          {code} – {name}
        </option>
      ))}
    </select>
  )
}
