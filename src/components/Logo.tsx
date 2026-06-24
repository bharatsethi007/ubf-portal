const LOGO_SRC = '/ub-freight-logo.png'

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo${compact ? ' logo--compact' : ''}`}>
      <img
        src={LOGO_SRC}
        alt="UB Freight"
        className="logo__img"
        width={compact ? 120 : 160}
        height={compact ? 36 : 48}
        decoding="async"
      />
    </div>
  )
}
