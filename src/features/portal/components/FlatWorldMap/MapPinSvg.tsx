type Props = { x: number; y: number; color: string; scale?: number }

/** Lucide-style map pin, tip anchored at (x, y). Scale down when viewBox is cropped. */
export default function MapPinSvg({ x, y, color, scale = 1 }: Props) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`} aria-hidden>
      <path
        d="M0,-11 C-3.6,-11 -6.5,-8 -6.5,-4.5 C-6.5,-1.5 0,5 0,5 C0,5 6.5,-1.5 6.5,-4.5 C6.5,-8 3.6,-11 0,-11 Z"
        fill={color}
        stroke="#fff"
        strokeWidth="0.8"
      />
      <circle cx="0" cy="-4.5" r="1.6" fill="#fff" />
    </g>
  )
}
