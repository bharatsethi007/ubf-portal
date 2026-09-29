// Pacific map geometry. Equal-scale projection covering lon 163E to 170W, lat 11S to 39S.
export const MAP_W = 620
export const MAP_H = 640
const SCALE = 23

export type Pt = { x: number; y: number }

export function project(lat: number, lng: number): Pt {
  const lon = lng < 0 ? lng + 360 : lng
  return { x: (lon - 163) * SCALE, y: (-lat - 11) * SCALE }
}

export function inView(p: Pt): boolean {
  return p.x >= -20 && p.x <= MAP_W + 20 && p.y >= -20 && p.y <= MAP_H + 60
}

/** Gentle quadratic arc between two points, bulging away from the straight line. */
export function arcPath(a: Pt, b: Pt): string {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const bend = b.x >= a.x ? 0.18 : -0.18
  const cx = mx - dy * bend
  const cy = my + dx * bend
  const r = (n: number) => Math.round(n * 10) / 10
  return `M${r(a.x)} ${r(a.y)} Q${r(cx)} ${r(cy)} ${r(b.x)} ${r(b.y)}`
}

/** Simplified coastlines (NZ North Island, New Caledonia, Fiji, Vanuatu, Tonga, Samoa). */
export const LAND: string[] = [
  'M223.1 538.2 L234.6 552.0 L259.9 565.8 L271.4 581.9 L289.8 588.8 L296.7 607.2 L322.0 618.7 L356.5 614.1 L351.9 634.8 L342.7 646.3 L322.0 657.8 L317.4 673.9 L299.0 694.6 L280.6 703.8 L269.1 696.9 L278.3 676.2 L257.6 657.8 L248.4 648.6 L266.8 634.8 L271.4 616.4 L266.8 598.0 L257.6 584.2 L236.9 565.8 L220.8 545.1 Z',
  'M20.7 209.3 L46.0 223.1 L73.6 241.5 L94.3 259.9 L82.8 264.5 L55.2 248.4 L29.9 230.0 Z',
  'M328.9 147.2 L345.0 144.9 L358.8 154.1 L358.8 163.3 L345.0 167.9 L331.2 163.3 L326.6 156.4 Z',
  'M358.8 124.2 L374.9 119.6 L391.0 117.3 L388.7 128.8 L372.6 135.7 L361.1 133.4 Z',
  'M342.7 182.8 L356.5 181.7 L356.5 187.4 L342.7 187.4 Z',
  'M80.5 87.4 L96.6 92.0 L96.6 105.8 L87.4 105.8 L80.5 96.6 Z',
  'M94.3 112.7 L110.4 117.3 L110.4 128.8 L98.9 126.5 Z',
  'M117.3 149.5 L128.8 149.5 L128.8 157.6 L117.3 157.6 Z',
  'M140.3 190.9 L149.5 193.2 L149.5 200.1 L140.3 197.8 Z',
  'M499.1 231.2 L508.3 232.3 L506.0 236.9 L499.1 235.8 Z',
  'M526.7 174.8 L533.6 174.8 L531.3 179.4 Z',
  'M570.4 64.4 L584.2 65.5 L581.9 70.2 L572.7 69.0 Z',
  'M556.6 56.3 L570.4 57.5 L568.1 64.4 L556.6 63.2 Z',
]

/** Only the larger shapes get the dot texture. */
export const LAND_TEXTURED = LAND.slice(0, 4)

/** "Nadi International Airport" -> "Nadi". */
export function shortPlace(name: string | null | undefined, code: string | null | undefined): string {
  const n = (name ?? '').trim()
  if (!n) return code ?? ''
  return n
    .replace(/\s+(International\s+)?Airport$/i, '')
    .replace(/\s+Bauerfield$/i, '')
    .replace(/^Faleolo$/i, 'Apia')
}
