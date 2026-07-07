import { geoContains } from 'd3-geo'
import land from '../../../../data/ne-110m-land.json'
import { projectLngLat } from './flatMapProjection'

let cache: { x: number; y: number }[] | null = null

export function getLandDots(): { x: number; y: number }[] {
  if (cache) return cache
  const dots: { x: number; y: number }[] = []
  for (let lat = -58; lat <= 72; lat += 2.4) {
    for (let lng = -180; lng < 180; lng += 2.4) {
      if (geoContains(land as Parameters<typeof geoContains>[0], [lng, lat])) {
        dots.push(projectLngLat(lng, lat))
      }
    }
  }
  cache = dots
  return dots
}
