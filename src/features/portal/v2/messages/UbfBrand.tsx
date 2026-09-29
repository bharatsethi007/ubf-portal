/** UB Freight identity for chat: white-background logo avatar and a verified tick. */
export function UbfAvatar({ size = 40 }: { size?: number }) {
  return (
    <span className="im-avatar im-avatar--logo" style={{ width: size, height: size }} aria-hidden>
      <img src="/ubf-avatar.png" alt="" width={size} height={size} />
    </span>
  )
}

export function VerifiedTick({ size = 15 }: { size?: number }) {
  return (
    <svg className="im-tick" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Verified">
      <path fill="#0A7CFF" d="M12 1.5l2.6 1.9 3.2-.2 1 3.1 2.7 1.8-1 3.1 1 3.1-2.7 1.8-1 3.1-3.2-.2L12 22.5l-2.6-1.9-3.2.2-1-3.1-2.7-1.8 1-3.1-1-3.1 2.7-1.8 1-3.1 3.2.2z" />
      <path fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M7.8 12.2l2.8 2.8 5.6-5.8" />
    </svg>
  )
}

/** "UB Freight" with the tick, for headers and name labels. */
export function UbfName({ prefix }: { prefix?: string }) {
  return <span className="im-ubf">{prefix}UB Freight <VerifiedTick size={13} /></span>
}
