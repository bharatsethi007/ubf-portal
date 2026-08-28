import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Eraser } from 'lucide-react'

type Props = {
  value: string | null
  onChange: (dataUrl: string | null) => void
  height?: number
  label?: string
}

/** Dependency-free signature capture. Emits a PNG data URL on stroke end, null on clear. */
export default function SignaturePad({ value, onChange, height = 150, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const sized = useRef(false)
  const [hasInk, setHasInk] = useState(Boolean(value))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const size = () => {
      if (sized.current) return
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#0A2472'
      }
      sized.current = true
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  function pos(e: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  function start(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = pos(e)
  }
  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !last.current) return
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }
  function end() {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    setHasInk(true)
    onChange(canvasRef.current?.toDataURL('image/png') ?? null)
  }
  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
    onChange(null)
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs font-medium text-neutral-500">{label}</span>}
      <div className="relative rounded-lg border border-neutral-300 bg-white">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height, touchAction: 'none' }}
          className="rounded-lg"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-300">
            Sign here
          </span>
        )}
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white/90 px-2 py-1 text-xs text-neutral-500 hover:text-neutral-800"
        >
          <Eraser size={12} /> Clear
        </button>
      </div>
    </div>
  )
}
