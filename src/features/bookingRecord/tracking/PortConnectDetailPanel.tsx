import type { DetailField } from './portConnectDetailFields'

type Props = {
  title: string
  fields: DetailField[]
}

export default function PortConnectDetailPanel({ title, fields }: Props) {
  return (
    <div className="pc-detail-panel">
      <h3 className="pc-detail-panel__title">{title}</h3>
      <dl className="pc-detail-panel__list">
        {fields.map((field, i) => (
          <div
            key={field.label}
            className={`pc-detail-panel__row${i % 2 ? ' pc-detail-panel__row--alt' : ''}`}
          >
            <dt>{field.label}</dt>
            <dd>{field.value || '\u00a0'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
