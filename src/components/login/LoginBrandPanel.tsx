import illustration from '../../assets/login-illustration.svg'

export default function LoginBrandPanel() {
  return (
    <aside className="login-brand" aria-hidden>
      <p className="login-brand__tagline">
        Moving freight across NZ, Australia &amp; the Pacific
      </p>
      <div className="login-brand__art">
        <img src={illustration} alt="" className="login-brand__illustration" />
      </div>
    </aside>
  )
}
