import ExternalNotesField from '../ExternalNotesField'
import { Card, area, lbl } from './qdUi'

type Props = { internal: string | null; external: string | null; onInternal: (v: string | null) => void; onExternal: (v: string | null) => void }

/** Internal (team only) and external (prints on the quote), side by side at the foot of the record. */
export default function QuoteNotesCard({ internal, external, onInternal, onExternal }: Props) {
  return (
    <Card title="Notes">
      <div className="grid grid-cols-1 gap-4 px-4 py-3.5 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={lbl}>Internal <span className="ml-1 normal-case tracking-normal text-[#98A2B3]">· team only</span></span>
          <textarea className={area} value={internal ?? ''} onChange={(e) => onInternal(e.target.value || null)} />
        </label>
        <ExternalNotesField value={external ?? ''} onChange={(v) => onExternal(v || null)} />
      </div>
    </Card>
  )
}
