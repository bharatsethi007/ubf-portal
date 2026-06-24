export type Port = {
  code: string
  name: string
  lat: number
  lng: number
}

export type PortMap = Map<string, Port>

export type MapPortPoint = {
  code: string
  name: string
  lng: number
  lat: number
  count: number
}
