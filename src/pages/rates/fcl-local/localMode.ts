// Sea FCL and Sea LCL local/port charges share one module; mode switches labels, paths and bases.
export type LocalMode = 'fcl' | 'lcl'

export const LOCAL_MODE: Record<LocalMode, { title: string; base: string; blurb: string }> = {
  fcl: {
    title: 'Sea FCL Local / Port Charges',
    base: '/setup/rates/fcl-local',
    blurb: 'House tariff of origin & destination local charges, keyed by port, movement, and shipping line.',
  },
  lcl: {
    title: 'Sea LCL Local / Port Charges',
    base: '/setup/rates/lcl-local',
    blurb: 'House tariff of origin & destination LCL charges (per W/M, per CBM, per B/L), keyed by port, movement, and co-loader.',
  },
}
