export const MAP_W = 360
export const MAP_H = 180

export function projectLngLat(lng: number, lat: number): { x: number; y: number } {
  return {
    x: ((lng + 180) / 360) * MAP_W,
    y: ((90 - lat) / 180) * MAP_H,
  }
}
