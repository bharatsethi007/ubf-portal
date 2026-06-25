import { useState } from 'react'
import { Copy } from 'lucide-react'

type Props = {
  mode: string
  value: string | null
}

export default function MasterBillField({ mode, value }: Props) {
  const label = mode === 'air' ? 'AWB' : 'BL'
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="job-drawer__fact master-bill-field">
      <dt>{label}</dt>
      <dd className="master-bill-field__value">
        <span className="mono">{value ?? '—'}</span>
        {value && (
          <button type="button" className="master-bill-field__copy" onClick={copy} title={`Copy ${label}`}>
            <Copy size={14} />
          </button>
        )}
        {copied && <span className="master-bill-field__copied muted">Copied</span>}
      </dd>
    </div>
  )
}
