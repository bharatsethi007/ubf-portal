// Public tracking API: no auth, the share token is the key.
export type LngLat = [number, number]
export type Detail = { label: string; at: string | null; estimated: boolean; done: boolean }
export type Milestone = {
  key: string; title: string; place: string | null; at: string | null
  estimated: boolean; done: boolean; current: boolean; details: Detail[]
}
export type TrackStatus = 'booked' | 'sailing' | 'arrived' | 'released' | 'delivered'
export type PublicTrack = {
  ref: string | null
  status: TrackStatus
  origin: { code: string | null; name: string | null; coord: LngLat | null }
  destination: { code: string | null; name: string | null; coord: LngLat | null }
  eta: { predicted: string | null; actual: string | null; scheduled: string | null; delay_hours: number | null }
  vessel: {
    name: string | null; voyage: string | null; position: LngLat | null; speed_kn: number | null
    heading: number | null; position_at: string | null; nm_to_go: number | null
  } | null
  containers: { no: string; type: string | null }[]
  milestones: Milestone[]
  stops: { code: string | null; name: string; coord: LngLat | null; role: 'origin' | 'tranship' | 'destination' }[]
  track: LngLat[]
  remaining: LngLat[]
  planned: LngLat[]
  updated_at: string | null
  expires_at: string
}

export type TrackResult =
  | { kind: 'ok'; data: PublicTrack }
  | { kind: 'missing' | 'expired' | 'revoked' | 'error' }

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share-track`
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export async function fetchTrack(token: string, poll = false): Promise<TrackResult> {
  try {
    const res = await fetch(FN, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: ANON },
      body: JSON.stringify({ token, poll: poll ? 1 : 0 }),
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok) return { kind: 'ok', data: body as PublicTrack }
    if (res.status === 404) return { kind: 'missing' }
    if (body?.error === 'revoked') return { kind: 'revoked' }
    if (body?.error === 'expired') return { kind: 'expired' }
    return { kind: 'error' }
  } catch {
    return { kind: 'error' }
  }
}
