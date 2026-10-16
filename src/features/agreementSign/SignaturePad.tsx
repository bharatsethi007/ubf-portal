import { useEffect, useRef, useState } from 'react'

type Props = { onChange: (dataUrl: string | null) => void }

/** Draw-your-signature canvas. Pointer events, so mouse, touch and pen all work. */
export default function SignaturePad({ onChange }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ratio = window.devicePixelRatio || 1
    c.width = c.offsetWidth * ratio
    c.height = c.offsetHeight * ratio
    const ctx = c.getContext('2d')!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0A2472'
  }, [])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const ctx = e.currentTarget.getContext('2d')!
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = e.currentTarget.getContext('2d')!
    const p = pos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    if (empty) setEmpty(false)
  }
  function up() {
    if (!drawing.current) return
    drawing.current = false
    if (ref.current && !empty) onChange(ref.current.toDataURL('image/png'))
  }
  function clear() {
    const c = ref.current
    if (!c) return
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setEmpty(true)
    onChange(null)
  }

  return (
    <div className="relative">
      <canvas
        ref={ref}
        aria-label="Draw your signature"
        className="block h-[120px] w-full touch-none rounded-[10px] border border-dashed border-[#C7D0E6] bg-[#FAFBFD]"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
      />
      {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12.5px] text-[#94A3B8]">Sign here with mouse or finger</span>}
      <button type="button" onClick={clear} className="absolute right-2 top-2 rounded-md bg-white px-2 py-0.5 text-[11.5px] text-[#5B6474] shadow-sm">Clear</button>
    </div>
  )
}
