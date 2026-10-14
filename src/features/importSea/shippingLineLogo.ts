// Shipping line logo resolution.
// Board stores free-text line names ("Maersk Line", "CMA", "Ocean Network Express (ONE)").
// Resolve to a canonical code, then try bundled /line-logos/{CODE}.png, then the favicon.

export type ShippingLineInfo = { code: string; label: string; domain: string }

const LINES: { code: string; label: string; domain: string; match: RegExp }[] = [
  { code: 'MAERSK', label: 'Maersk', domain: 'maersk.com', match: /\bmaersk\b|^msk$/ },
  { code: 'ANL', label: 'ANL', domain: 'anl.com.au', match: /australian national|^anl\b/ },
  { code: 'COSCO', label: 'COSCO', domain: 'coscoshipping.com', match: /\bcosco\b/ },
  { code: 'CMA', label: 'CMA CGM', domain: 'cma-cgm.com', match: /\bcma\b/ },
  { code: 'PIL', label: 'PIL', domain: 'pilship.com', match: /^pil\b|pacific international/ },
  { code: 'ONE', label: 'ONE', domain: 'one-line.com', match: /ocean network|^one$/ },
  { code: 'OOCL', label: 'OOCL', domain: 'oocl.com', match: /orient overseas|\boocl\b/ },
  { code: 'NPDL', label: 'Neptune Pacific', domain: 'npdlship.com', match: /neptune/ },
  { code: 'MSC', label: 'MSC', domain: 'msc.com', match: /^msc\b|mediterranean shipping/ },
  { code: 'HLAG', label: 'Hapag-Lloyd', domain: 'hapag-lloyd.com', match: /hapag/ },
  { code: 'EMC', label: 'Evergreen', domain: 'evergreen-line.com', match: /evergreen/ },
  { code: 'HMM', label: 'HMM', domain: 'hmm21.com', match: /^hmm\b|hyundai merchant/ },
  { code: 'YML', label: 'Yang Ming', domain: 'yangming.com', match: /yang ?ming/ },
  { code: 'ZIM', label: 'ZIM', domain: 'zim.com', match: /^zim\b/ },
  { code: 'MATSON', label: 'Matson', domain: 'matson.com', match: /matson/ },
  { code: 'SWIRE', label: 'Swire Shipping', domain: 'swireshipping.com', match: /swire|china navigation/ },
]

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function resolveShippingLine(name?: string | null): ShippingLineInfo | null {
  const n = norm(name ?? '')
  if (!n) return null
  const hit = LINES.find((l) => l.match.test(n))
  return hit ? { code: hit.code, label: hit.label, domain: hit.domain } : null
}

// Ordered URLs to try. ShippingLineLogo advances on each onError.
export function shippingLineLogoSources(info: ShippingLineInfo): string[] {
  return [
    `/line-logos/${info.code}.png`,
    `https://www.google.com/s2/favicons?domain=${info.domain}&sz=64`,
  ]
}
