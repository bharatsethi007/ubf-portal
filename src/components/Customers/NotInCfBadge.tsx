/** Shown on customers created in the portal that don't exist in CyberFreight yet. */
export default function NotInCfBadge({ source }: { source?: string | null }) {
  if (source !== 'portal') return null
  return (
    <span
      title="Created in the portal. Not yet set up in CyberFreight."
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10,
        fontWeight: 600,
        lineHeight: '16px',
        padding: '0 6px',
        borderRadius: 999,
        color: '#B45309',
        background: '#FFF7E6',
        border: '1px solid #FCD9A6',
        whiteSpace: 'nowrap',
      }}
    >
      Not in CF
    </span>
  )
}
