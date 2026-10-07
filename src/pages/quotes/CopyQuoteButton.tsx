import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { copyQuote } from './quoteCopyApi'

type Props = { quoteId: string; quoteNo: string | null; size?: number }

export default function CopyQuoteButton({ quoteId, quoteNo, size = 15 }: Props) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function run(e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm(`Copy ${quoteNo ?? 'this quote'} to a new quote?`)) return
    setBusy(true)
    try {
      const id = await copyQuote(quoteId)
      toast.success(`Copied ${quoteNo ?? 'quote'}`)
      navigate(`/quotes/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Copy failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" className="icon-btn" title="Copy quote" aria-label="Copy quote" disabled={busy} onClick={run}>
      <Copy size={size} strokeWidth={2} />
    </button>
  )
}
