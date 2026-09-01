import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import { toast } from 'sonner'
import './meetingRecorder.css'

type RecState = 'idle' | 'requesting' | 'recording' | 'paused'

const PAUSE_AFTER_SEC = 17 * 60 // pause + prompt after this much *recorded* time
const GRACE_SEC = 3 * 60 // auto-stop this long after the prompt if no response

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function VoiceOrb({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
  const scaleRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!analyser || !active) return
    const data = new Uint8Array(analyser.frequencyBinCount)
    let raf = 0
    const tick = () => {
      analyser.getByteFrequencyData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i]
      const avg = sum / data.length / 255 // 0..1
      const el = scaleRef.current
      if (el) el.style.transform = `scale(${(1 + avg * 0.55).toFixed(3)})`
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [analyser, active])
  return (
    <div className={`voice-orb${active ? ' voice-orb--active' : ''}`} aria-hidden>
      <div ref={scaleRef} className="voice-orb__scale">
        <div className="voice-orb__layer voice-orb__l1" />
        <div className="voice-orb__layer voice-orb__l2" />
        <div className="voice-orb__layer voice-orb__l3" />
      </div>
    </div>
  )
}

type Props = {
  onComplete: (blob: Blob, seconds: number) => void
  className?: string
}

export default function MeetingRecorder({ onComplete, className }: Props) {
  const [state, setState] = useState<RecState>('idle')
  const [recSec, setRecSec] = useState(0)
  const [graceLeft, setGraceLeft] = useState(GRACE_SEC)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const ctxRef = useRef<AudioContext | null>(null)
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const graceTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextPauseRef = useRef(PAUSE_AFTER_SEC)

  const cleanupAudio = useCallback(() => {
    if (recTimer.current) clearInterval(recTimer.current)
    if (graceTimer.current) clearInterval(graceTimer.current)
    recTimer.current = null
    graceTimer.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (ctxRef.current && ctxRef.current.state !== 'closed') void ctxRef.current.close()
    ctxRef.current = null
    setAnalyser(null)
  }, [])

  useEffect(() => cleanupAudio, [cleanupAudio])

  const finalize = useCallback(() => {
    if (graceTimer.current) clearInterval(graceTimer.current)
    if (recTimer.current) clearInterval(recTimer.current)
    graceTimer.current = null
    recTimer.current = null
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      rec.stop() // onstop handler fires onComplete
    } else {
      cleanupAudio()
      setState('idle')
    }
  }, [cleanupAudio])

  const startGrace = useCallback(() => {
    setGraceLeft(GRACE_SEC)
    if (graceTimer.current) clearInterval(graceTimer.current)
    graceTimer.current = setInterval(() => {
      setGraceLeft((g) => {
        if (g <= 1) {
          finalize()
          return 0
        }
        return g - 1
      })
    }, 1000)
  }, [finalize])

  const autoPause = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state === 'recording') rec.pause()
    if (recTimer.current) clearInterval(recTimer.current)
    recTimer.current = null
    setState('paused')
    startGrace()
  }, [startGrace])

  const startRecTimer = useCallback(() => {
    if (recTimer.current) clearInterval(recTimer.current)
    recTimer.current = setInterval(() => {
      setRecSec((s) => {
        const next = s + 1
        if (next >= nextPauseRef.current) autoPause()
        return next
      })
    }, 1000)
  }, [autoPause])

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Recording is not supported on this device/browser')
      return
    }
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const Ctx: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      ctxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const an = ctx.createAnalyser()
      an.fftSize = 64
      source.connect(an)
      setAnalyser(an)

      const mimeType = pickMimeType()
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const type = rec.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        const seconds = recSecRef.current
        cleanupAudio()
        setState('idle')
        setRecSec(0)
        nextPauseRef.current = PAUSE_AFTER_SEC
        if (blob.size > 0) onComplete(blob, seconds)
      }
      recorderRef.current = rec
      rec.start(1000)
      setRecSec(0)
      nextPauseRef.current = PAUSE_AFTER_SEC
      setState('recording')
      startRecTimer()
    } catch {
      cleanupAudio()
      setState('idle')
      toast.error('Microphone access was blocked')
    }
  }

  function resume() {
    const rec = recorderRef.current
    if (graceTimer.current) clearInterval(graceTimer.current)
    graceTimer.current = null
    nextPauseRef.current += PAUSE_AFTER_SEC
    if (rec && rec.state === 'paused') rec.resume()
    setState('recording')
    startRecTimer()
  }

  // keep a ref of recSec so the onstop closure reads the final value
  const recSecRef = useRef(0)
  useEffect(() => {
    recSecRef.current = recSec
  }, [recSec])

  if (state === 'idle') {
    return (
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted ${className ?? ''}`}
        onClick={start}
      >
        <Mic size={15} />
        Transcribe
      </button>
    )
  }

  if (state === 'requesting') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[13px] text-muted-foreground ${className ?? ''}`}>
        <Loader2 size={15} className="animate-spin" />
        Starting…
      </span>
    )
  }

  return (
    <>
      <div
        className={`inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1 ${className ?? ''}`}
      >
        <VoiceOrb analyser={analyser} active={state === 'recording'} />
        <span className="tabular-nums text-[13px] font-medium text-foreground">{fmt(recSec)}</span>
        <button
          type="button"
          aria-label="Stop recording"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-red-600 transition-colors hover:bg-red-50"
          onClick={finalize}
        >
          <Square size={13} fill="currentColor" />
        </button>
      </div>

      {state === 'paused' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-xl">
            <div className="text-sm font-semibold text-foreground">Still recording?</div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Paused at {fmt(recSec)}. It will stop and save automatically in {fmt(graceLeft)}.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                onClick={finalize}
              >
                Stop &amp; save
              </button>
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
                onClick={resume}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
