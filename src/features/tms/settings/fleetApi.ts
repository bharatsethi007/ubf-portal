import { supabase } from '@/supabase'

export type VehicleIssue = { id: string; label: string; severity: 'info' | 'warn' | 'critical'; status: 'open' | 'resolved' }
export type FleetVehicle = {
  id: string
  registration_number: string
  photo_url: string | null
  model: string | null
  rego_expiry: string | null
  cof_expiry: string | null
  last_service_at: string | null
  next_service_at: string | null
  active: boolean
  current_driver: string | null
  issues: VehicleIssue[]
}

const norm = (s?: string | null) => (s ?? '').replace(/\s+/g, '').toUpperCase()

export async function listFleetVehicles(): Promise<FleetVehicle[]> {
  const { data, error } = await supabase
    .from('tms_vehicles')
    .select(`id,registration_number,photo_url,model,rego_expiry,cof_expiry,last_service_at,next_service_at,active,
      logons:tms_driver_vehicle!tms_driver_vehicle_vehicle_id_fkey(logged_on_at,logged_off_at,driver:tms_drivers!tms_driver_vehicle_driver_id_fkey(first_name,last_name)),
      issues:tms_vehicle_issues(id,label,severity,status)`)
    .order('registration_number')
  if (error) throw error

  const modelByRego = new Map<string, string>()
  try {
    const { data: dv } = await supabase.from('dispatch_vehicles').select('registration,make,model')
    ;(dv ?? []).forEach((r: any) => {
      const m = [r.make, r.model].filter(Boolean).join(' ')
      if (m) modelByRego.set(norm(r.registration), m)
    })
  } catch { /* ignore */ }

  return (data ?? []).map((v: any) => {
    const activeLogon = (v.logons ?? [])
      .filter((l: any) => !l.logged_off_at)
      .sort((a: any, b: any) => (b.logged_on_at ?? '').localeCompare(a.logged_on_at ?? ''))[0]
    const drv = activeLogon?.driver
    return {
      id: v.id,
      registration_number: v.registration_number,
      photo_url: v.photo_url ?? null,
      model: v.model ?? modelByRego.get(norm(v.registration_number)) ?? null,
      rego_expiry: v.rego_expiry ?? null,
      cof_expiry: v.cof_expiry ?? null,
      last_service_at: v.last_service_at ?? null,
      next_service_at: v.next_service_at ?? null,
      active: v.active ?? true,
      current_driver: drv ? `${drv.first_name} ${drv.last_name?.[0] ?? ''}.` : null,
      issues: ((v.issues ?? []) as VehicleIssue[]).filter((i) => i.status === 'open'),
    }
  })
}

export const ENDORSEMENTS = [
  { key: '1', label: 'Class 1', short: 'C1' },
  { key: '2', label: 'Class 2', short: 'C2' },
  { key: '4', label: 'Class 4', short: 'C4' },
  { key: '5', label: 'Class 5', short: 'C5' },
  { key: 'DG', label: 'Dangerous goods', short: 'DG' },
] as const

export type FleetDriver = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  photo_url: string | null
  current_registration: string | null
  license_number: string | null
  license_expiry: string | null
  endorsements: string[]
  license_doc_url: string | null
  active: boolean
  online: boolean
}

export async function listFleetDrivers(): Promise<FleetDriver[]> {
  const { data, error } = await supabase
    .from('tms_drivers')
    .select('id,first_name,last_name,phone,photo_url,current_registration,license_number,license_expiry,endorsements,license_doc_url,active')
    .order('first_name')
  if (error) throw error
  const { data: sessions } = await supabase.from('tms_driver_vehicle').select('driver_id').is('logged_off_at', null)
  const onlineIds = new Set((sessions ?? []).map((s: any) => s.driver_id))
  return (data ?? []).map((d: any) => ({
    id: d.id, first_name: d.first_name, last_name: d.last_name, phone: d.phone ?? null,
    photo_url: d.photo_url ?? null, current_registration: d.current_registration ?? null,
    license_number: d.license_number ?? null, license_expiry: d.license_expiry ?? null,
    endorsements: d.endorsements ?? [], license_doc_url: d.license_doc_url ?? null,
    active: d.active ?? true, online: onlineIds.has(d.id),
  }))
}

export type VehicleInput = {
  registration_number: string
  model: string | null
  photo_url: string | null
  rego_expiry: string | null
  cof_expiry: string | null
  last_service_at: string | null
  next_service_at: string | null
  active: boolean
}

export async function uploadVehiclePhoto(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `vehicles/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('fleet').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('fleet').getPublicUrl(path)
  return data.publicUrl
}

export async function createVehicle(input: VehicleInput): Promise<void> {
  const { error } = await supabase.from('tms_vehicles').insert(input)
  if (error) throw error
}

export async function updateVehicle(id: string, input: VehicleInput): Promise<void> {
  const { error } = await supabase.from('tms_vehicles').update(input).eq('id', id)
  if (error) throw error
}

export async function uploadDriverPhoto(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `drivers/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('fleet').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('fleet').getPublicUrl(path)
  return data.publicUrl
}

export type DriverInput = {
  first_name: string
  last_name: string
  phone: string | null
  photo_url: string | null
  license_number: string | null
  license_expiry: string | null
  endorsements: string[]
  license_doc_url: string | null
  active: boolean
}

export async function updateDriver(id: string, input: DriverInput): Promise<void> {
  const { error } = await supabase.from('tms_drivers').update(input).eq('id', id)
  if (error) throw error
}

export async function logOffDriver(driverId: string): Promise<void> {
  const { error } = await supabase.from('tms_driver_vehicle')
    .update({ logged_off_at: new Date().toISOString() })
    .eq('driver_id', driverId).is('logged_off_at', null)
  if (error) throw error
  await supabase.from('tms_drivers').update({ current_registration: null }).eq('id', driverId)
}

export async function uploadDriverLicenseDoc(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
  const path = `licences/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('fleet-docs').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export async function getLicenseDocSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('fleet-docs').createSignedUrl(path, 300)
  if (error) return null
  return data?.signedUrl ?? null
}
