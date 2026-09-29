import { Check, Download, FileCheck2, FileText, PackageCheck, Receipt, ShieldCheck } from 'lucide-react'

const DOCS = [
  { icon: FileText, name: 'Bill of lading', meta: 'Telex released', tag: 'Released' },
  { icon: ShieldCheck, name: 'Customs entry', meta: 'Fiji Revenue & Customs', tag: 'Cleared' },
  { icon: FileCheck2, name: 'Proof of delivery', meta: 'Signed 13 Oct, 10:42', tag: 'Signed' },
]

/** Stage 3 — docs release, customs clears, invoice gets paid, shipment delivered. */
export default function ExecuteStage() {
  return (
    <div className="ls-stage">
      <div className="ls-stage__head">
        <div>
          <p className="ls-eyebrow">124285 · Documents</p>
          <p className="ls-title">Everything in one place</p>
        </div>
        <span className="ls-pill ls-pill--done">Delivered</span>
      </div>

      <ul className="ls-docs">
        {DOCS.map((d, i) => (
          <li key={d.name} className="ls-doc" style={{ ['--d' as string]: `${0.3 + i * 0.55}s` }}>
            <span className="ls-doc__icon"><d.icon size={15} /></span>
            <span className="ls-doc__text">
              <span className="ls-doc__name">{d.name}</span>
              <span className="ls-doc__meta">{d.meta}</span>
            </span>
            <span className="ls-doc__tag">
              <Check size={11} strokeWidth={3} />{d.tag}
            </span>
          </li>
        ))}
      </ul>

      <div className="ls-inv" style={{ ['--d' as string]: '2s' }}>
        <span className="ls-doc__icon ls-doc__icon--blue"><Receipt size={15} /></span>
        <span className="ls-doc__text">
          <span className="ls-doc__name">Invoice 58210</span>
          <span className="ls-doc__meta">Due 27 Oct</span>
        </span>
        <span className="ls-inv__amt">NZD 4,280.00</span>
        <span className="ls-inv__btn">
          <span className="ls-inv__pay"><Download size={12} strokeWidth={2.6} />PDF</span>
          <span className="ls-inv__paid"><Check size={12} strokeWidth={3} />Saved</span>
        </span>
      </div>

      <div className="ls-delivered">
        <span className="ls-delivered__icon"><PackageCheck size={18} /></span>
        <div>
          <p className="ls-delivered__title">Delivered to consignee</p>
          <p className="ls-delivered__sub">Suva · Mon 13 Oct · on time</p>
        </div>
      </div>
    </div>
  )
}
