import { useMemo } from 'react'
import { DOT_ROWS, project } from './pacificDots'

type Port = { code: string; name: string; lng: number; lat: number; hub?: boolean }

const PORTS: Port[] = [
  { code: 'AKL', name: 'Auckland', lng: 174.8, lat: -36.9, hub: true },
  { code: 'SUV', name: 'Suva', lng: 178.4, lat: -18.1, hub: true },
  { code: 'SYD', name: 'Sydney', lng: 151.2, lat: -33.9 },
  { code: 'BNE', name: 'Brisbane', lng: 153.0, lat: -27.5 },
  { code: 'MEL', name: 'Melbourne', lng: 144.9, lat: -37.8 },
  { code: 'TBU', name: "Nuku'alofa", lng: -175.2, lat: -21.1 },
  { code: 'APW', name: 'Apia', lng: -171.8, lat: -13.8 },
  { code: 'NOU', name: 'Noumea', lng: 166.4, lat: -22.3 },
  { code: 'VLI', name: 'Port Vila', lng: 168.3, lat: -17.7 },
  { code: 'RAR', name: 'Rarotonga', lng: -159.8, lat: -21.2 },
  { code: 'LYC', name: 'Christchurch', lng: 172.6, lat: -43.5 },
]

/** [from, to, kind] — exports orange, imports blue (portal rule). */
const LANES: [string, string, 'exp' | 'imp'][] = [
  ['AKL', 'TBU', 'exp'],
  ['AKL', 'APW', 'exp'],
  ['AKL', 'RAR', 'exp'],
  ['SYD', 'AKL', 'imp'],
  ['BNE', 'NOU', 'exp'],
  ['MEL', 'AKL', 'imp'],
  ['AKL', 'VLI', 'exp'],
  ['BNE', 'SUV', 'imp'],
]

const byCode = Object.fromEntries(PORTS.map((p) => [p.code, p]))

function arc(a: string, b: string, bend = 0.22): string {
  const [x1, y1] = project(byCode[a].lng, byCode[a].lat)
  const [x2, y2] = project(byCode[b].lng, byCode[b].lat)
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const cx = mx - dy * bend
  const cy = my + dx * bend
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

export const HERO_PATH = arc('AKL', 'SUV', -0.25)

export default function ShowcaseMap() {
  const dots = useMemo(() => {
    const out: [number, number][] = []
    DOT_ROWS.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] === '1') out.push([c * 10 + 5, r * 10 + 5])
    })
    return out
  }, [])

  return (
    <svg className="ls-map" viewBox="215 40 355 360" preserveAspectRatio="xMaxYMid slice" aria-hidden>
      <defs>
        <radialGradient id="ls-glow">
          <stop offset="0%" stopColor="#8fa6ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#8fa6ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ls-hero" x1="0" x2="1" y1="1" y2="0">
          <stop offset="0%" stopColor="#f5843c" />
          <stop offset="100%" stopColor="#ffd2a8" />
        </linearGradient>
      </defs>

      <g className="ls-map__dots">
        {dots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.6} />
        ))}
      </g>

      <g className="ls-map__lanes">
        {LANES.map(([a, b, k], i) => (
          <path
            key={`${a}-${b}`}
            d={arc(a, b)}
            className={`ls-lane ls-lane--${k}`}
            style={{ animationDelay: `${i * -0.7}s` }}
          />
        ))}
      </g>

      <path d={HERO_PATH} className="ls-hero-track" />
      <path d={HERO_PATH} className="ls-hero-line" stroke="url(#ls-hero)" pathLength={1} />

      {PORTS.map((p) => {
        const [x, y] = project(p.lng, p.lat)
        return (
          <g key={p.code} transform={`translate(${x} ${y})`} className={p.hub ? 'ls-port ls-port--hub' : 'ls-port'}>
            <circle r={p.hub ? 14 : 8} fill="url(#ls-glow)" className="ls-port__halo" />
            <circle r={p.hub ? 3 : 2} className="ls-port__dot" />
            <text x={p.hub ? 7 : 5} y={3} className="ls-port__label">{p.hub ? p.name : p.code}</text>
          </g>
        )
      })}

      <g className="ls-ship">
        <circle r={9} fill="url(#ls-glow)" className="ls-ship__halo" />
        <circle r={3.4} className="ls-ship__dot" />
        <animateMotion dur="14s" repeatCount="indefinite" path={HERO_PATH} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
      </g>
    </svg>
  )
}
