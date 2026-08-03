import { useEffect, useRef, useState } from 'react'
import { Sparkles, Send, X } from 'lucide-react'
import { useSeaPorts } from '../../hooks/useSeaPorts'
import { fetchPortAliases, searchFclRates, type RateOption, type QuoteLane } from './rateSearchApi'
import { resolveRateQuery } from './rateChatResolver'
import RateOptionCard from './RateOptionCard'
import './rateSearchChat.css'

type Msg = { id: string; role: 'bot' | 'user'; text?: string; options?: RateOption[]; lane?: QuoteLane }
let seq = 0
const mid = () => `m${++seq}`

export default function RateSearchChat({ onUseRate, onClose }: { onUseRate: (o: RateOption, lane: QuoteLane) => Promise<void> | void; onClose?: () => void }) {
  const { ports } = useSeaPorts()
  const [aliases, setAliases] = useState<{ alias: string; port_code: string }[]>([])
  const [messages, setMessages] = useState<Msg[]>([{ id: mid(), role: 'bot', text: 'Hi! Tell me a lane and I\u2019ll find your rates \u2014 e.g. \u201CNingbo to Auckland, 2\u00d740ft\u201D.' }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [usingId, setUsingId] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchPortAliases().then(setAliases).catch(() => {}) }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setMessages((m) => [...m, { id: mid(), role: 'user', text }])
    setBusy(true)
    try {
      const r = resolveRateQuery(text, ports.map((p) => ({ code: p.code, name: p.name })), aliases)
      if (!r.from || !r.to) {
        const need = !r.from && !r.to ? 'both the origin and destination ports' : !r.from ? 'the origin port' : 'the destination port'
        setMessages((m) => [...m, { id: mid(), role: 'bot', text: `I couldn\u2019t catch ${need}. Try naming them, e.g. \u201CShanghai to Auckland\u201D.` }])
        return
      }
      const lane: QuoteLane = { from_port_code: r.from.code, to_port_code: r.to.code, currency: null, containers: r.containers }
      const options = await searchFclRates(lane)
      const summary = r.containers.map((c) => `${c.qty}\u00d7${c.size}`).join(', ')
      if (options.length === 0) {
        setMessages((m) => [...m, { id: mid(), role: 'bot', text: `No active rates for ${r.from!.name} \u2192 ${r.to!.name} (${summary}). Try another lane, or check the rate card status.` }])
      } else {
        setMessages((m) => [...m, { id: mid(), role: 'bot', text: `${options.length} rate${options.length === 1 ? '' : 's'} for ${r.from!.name} \u2192 ${r.to!.name}${r.assumedContainer ? ' (assumed 1\u00d720ft \u2014 name the equipment to change)' : ` \u00b7 ${summary}`}:`, options, lane }])
      }
    } catch (e) {
      setMessages((m) => [...m, { id: mid(), role: 'bot', text: e instanceof Error ? e.message : 'Search failed.' }])
    } finally {
      setBusy(false)
    }
  }

  async function use(o: RateOption, lane: QuoteLane) {
    if (usingId) return
    setUsingId(o.cardId)
    try {
      await onUseRate(o, lane)
      setMessages((m) => [...m, { id: mid(), role: 'bot', text: `Added ${o.carrierName} to your buy rates. \u2728` }])
    } catch (e) {
      setMessages((m) => [...m, { id: mid(), role: 'bot', text: e instanceof Error ? e.message : 'Could not add that rate.' }])
    } finally {
      setUsingId(null)
    }
  }

  return (
    <div className="rsc">
      <div className="rsc__header">
        <div className="rsc__brand"><Sparkles size={16} /> <span>Rate Assistant</span></div>
        {onClose && <button className="rsc__x" onClick={onClose} aria-label="Close"><X size={16} /></button>}
      </div>
      <div className="rsc__thread">
        {messages.map((m) => (
          <div key={m.id} className={`rsc__row rsc__row--${m.role}`}>
            <div className={`rsc__bubble rsc__bubble--${m.role}`}>
              {m.text && <div>{m.text}</div>}
              {m.options && m.lane && (
                <div className="rsc__options">
                  {m.options.map((o) => (
                    <RateOptionCard key={o.cardId} option={o} fromCode={m.lane!.from_port_code!} toCode={m.lane!.to_port_code!} onUse={() => use(o, m.lane!)} busy={usingId === o.cardId} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="rsc__row rsc__row--bot"><div className="rsc__bubble rsc__bubble--bot rsc__typing"><span></span><span></span><span></span></div></div>}
        <div ref={endRef} />
      </div>
      <div className="rsc__input">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send() }} placeholder="e.g. Ningbo to Auckland, 2×40ft" />
        <button className="rsc__send" onClick={send} disabled={busy || !input.trim()} aria-label="Send"><Send size={16} /></button>
      </div>
    </div>
  )
}
