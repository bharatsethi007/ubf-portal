import { Check, MousePointer2, Plane, Ship, Package } from 'lucide-react'

/** Stage 1 — booking form fills itself, then confirms. Pure CSS timeline (see loginShowcase.css). */
export default function BookStage() {
  return (
    <div className="ls-stage">
      <div className="ls-stage__head">
        <div>
          <p className="ls-eyebrow">New booking</p>
          <p className="ls-title">Where is it going?</p>
        </div>
        <span className="ls-pill ls-pill--exp">Export</span>
      </div>

      <div className="ls-seg">
        <span className="ls-seg__btn ls-seg__btn--on"><Ship size={13} />Sea FCL</span>
        <span className="ls-seg__btn"><Package size={13} />Sea LCL</span>
        <span className="ls-seg__btn"><Plane size={13} />Air</span>
      </div>

      <div className="ls-fields">
        <Field label="From" delay={0.5}>
          <span className="fi fi-nz ls-flag" />Auckland, NZ<span className="ls-code">NZAKL</span>
        </Field>
        <Field label="To" delay={1.4}>
          <span className="fi fi-fj ls-flag" />Suva, Fiji<span className="ls-code">FJSUV</span>
        </Field>
        <div className="ls-fields__row">
          <Field label="Equipment" delay={2.3}>1 × 40HQ</Field>
          <Field label="Cargo ready" delay={2.9}>06 Oct</Field>
        </div>
      </div>

      <div className="ls-rate">
        <div>
          <p className="ls-rate__label">Sailing · Tue 07 Oct</p>
          <p className="ls-rate__val">5 days port to port</p>
        </div>
        <p className="ls-rate__price"><span className="ls-live" />Live rate</p>
      </div>

      <div className="ls-cta-wrap">
        <span className="ls-cta">Request booking</span>
        <span className="ls-cta ls-cta--done">
          <Check size={15} strokeWidth={2.6} />Booked · 124285
        </span>
        <MousePointer2 className="ls-cursor" size={20} fill="#fff" />
      </div>
    </div>
  )
}

function Field({ label, delay, children }: { label: string; delay: number; children: React.ReactNode }) {
  return (
    <div className="ls-field" style={{ ['--d' as string]: `${delay}s` }}>
      <span className="ls-field__label">{label}</span>
      <span className="ls-field__val">
        <span className="ls-type">{children}</span>
        <span className="ls-caret" />
      </span>
    </div>
  )
}
