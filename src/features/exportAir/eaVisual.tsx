import { useEffect, useState } from 'react'
import { supabase } from '@/supabase'
import AirlineLogo from '@/pages/rates/AirlineLogo.tsx'

/** "NZ952" / "NZ 952" -> "NZ". Airline IATA codes are 2 chars, letters or digits. */
export const airlineOf = (flight: string | null | undefined) => {
  const m = (flight ?? '').trim().toUpperCase().match(/^([A-Z0-9]{2})\s?\d/)
  return m ? m[1] : null
}

/** Small airline logo for a flight number. Renders nothing when there is no logo. */
export function AirlineMark({ flight, name, size = 16 }: { flight: string | null | undefined; name?: string | null; size?: number }) {
  const code = airlineOf(flight)
  if (!code && !name) return null
  return <AirlineLogo code={code} name={name} size={size} />
}

// Pacific lanes resolve instantly; anything else is looked up once in ports and cached.
const KNOWN: Record<string, string> = {
  NAN: 'fj', SUV: 'fj', LBS: 'fj', RAR: 'ck', APW: 'ws', TBU: 'to', VLI: 'vu', NOU: 'nc', POM: 'pg', HIR: 'sb',
  FUN: 'tv', TRW: 'ki', AKL: 'nz', CHC: 'nz', WLG: 'nz', SYD: 'au', BNE: 'au', MEL: 'au', PTY: 'pa',
}
const cache = new Map<string, string | null>(Object.entries(KNOWN))
const pending = new Map<string, Promise<string | null>>()

function lookup(iata: string): Promise<string | null> {
  if (cache.has(iata)) return Promise.resolve(cache.get(iata) ?? null)
  if (!pending.has(iata)) {
    pending.set(iata, (async () => {
      const { data } = await supabase.from('ports').select('country_code').eq('code', iata).maybeSingle()
      const cc = (data?.country_code as string | undefined)?.toLowerCase() ?? null
      cache.set(iata, cc)
      return cc
    })())
  }
  return pending.get(iata)!
}

/** Destination country flag (flag-icons), sized for inline text. */
export function DestFlag({ iata, size = 13 }: { iata: string | null | undefined; size?: number }) {
  const code = (iata ?? '').trim().toUpperCase()
  const [cc, setCc] = useState<string | null>(() => cache.get(code) ?? null)
  useEffect(() => { if (code) void lookup(code).then(setCc) }, [code])
  if (!cc) return null
  return (
    <span aria-hidden className={`fi fi-${cc} shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(16,24,40,.08)]`}
      style={{ width: size * 1.33, height: size, backgroundSize: 'cover', display: 'inline-block' }} />
  )
}

/** "AKL → NAN" with the destination flag. */
export function Route({ dest, via, className = '' }: { dest: string | null | undefined; via?: string | null; className?: string }) {
  const d = (dest || 'NAN').toUpperCase()
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      AKL → <DestFlag iata={d} /> {d}{via ? <span className="text-[#98A2B3]">via {via}</span> : null}
    </span>
  )
}
