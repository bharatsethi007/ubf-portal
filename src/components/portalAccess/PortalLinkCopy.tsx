import { useState } from 'react'

type Props = {
  link: string
  expiresAt?: string
  onDismiss?: () => void
}

export default function PortalLinkCopy({ link, expiresAt, onDismiss }: Props) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="portal-access-link">
      <p className="portal-access-link__hint">
        Send this to the customer. Expires in 7 days{expiresAt ? ` (${new Date(expiresAt).toLocaleDateString()})` : ''}.
      </p>
      <div className="portal-access-link__row">
        <input className="input input--sm portal-access-link__input" readOnly value={link} aria-label="Set-password link" />
        <button type="button" className="btn portal-access__btn" onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
        {onDismiss && (
          <button type="button" className="text-link" onClick={onDismiss}>Done</button>
        )}
      </div>
    </div>
  )
}
