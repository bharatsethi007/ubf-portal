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

export type FleetDriver = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  photo_url: string | null
  current_registration: string | null
  active: boolean
}

export async function listFleetDrivers(): Promise<FleetDriver[]> {
  const { data, error } = await supabase
    .from('tms_drivers')
    .select('id,first_name,last_name,phone,photo_url,current_registration,active')
    .order('first_name')
  if (error) throw error
  return (data ?? []) as FleetDriver[]
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
