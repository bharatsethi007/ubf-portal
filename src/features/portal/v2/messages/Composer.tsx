import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'

type Props = { onSend: (body: string) => Promise<unknown>; placeholder?: string; autoFocus?: boolean; disabled?: boolean }

/** Pill input that grows with the text. Enter sends, Shift+Enter adds a line. */
export default function Composer({ onSend, placeholder = 'Message', autoFocus, disabled }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  async function send() {
    const body = text.trim()
    if (!body || busy || disabled) return
    setBusy(true); setText('')
    try { await onSend(body) } catch { setText(body) } finally { setBusy(false); ref.current?.focus() }
  }

  const ready = !!text.trim() && !busy && !disabled
  return (
    <form className="im-compose" onSubmit={(e) => { e.preventDefault(); void send() }}>
      <div className="im-compose__pill">
        <textarea ref={ref} rows={1} value={text} maxLength={4000} placeholder={placeholder} aria-label="Message"
          autoFocus={autoFocus} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send() } }} />
        <button type="submit" className="im-send" disabled={!ready} aria-label="Send"><ArrowUp size={16} strokeWidth={2.6} /></button>
      </div>
    </form>
  )
}
