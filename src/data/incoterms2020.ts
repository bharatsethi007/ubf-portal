export const INCOTERMS_2020 = [
  { code: 'EXW', name: 'Ex Works' },
  { code: 'FCA', name: 'Free Carrier' },
  { code: 'CPT', name: 'Carriage Paid To' },
  { code: 'CIP', name: 'Carriage and Insurance Paid To' },
  { code: 'DAP', name: 'Delivered at Place' },
  { code: 'DPU', name: 'Delivered at Place Unloaded' },
  { code: 'DDP', name: 'Delivered Duty Paid' },
  { code: 'FAS', name: 'Free Alongside Ship' },
  { code: 'FOB', name: 'Free On Board' },
  { code: 'CFR', name: 'Cost and Freight' },
  { code: 'CIF', name: 'Cost, Insurance and Freight' },
] as const

// Older terms still quoted by customers and agents (replaced in Incoterms 2010/2020).
export const LEGACY_INCOTERMS = [
  { code: 'DAT', name: 'Delivered at Terminal (now DPU)' },
  { code: 'DDU', name: 'Delivered Duty Unpaid (now DAP)' },
] as const

// The four maritime terms (FAS/FOB/CFR/CIF) are formally sea / inland waterway only,
// but FOB/CFR/CIF are still used on air in practice, so every term is selectable.
export const AIR_INCOTERM_CODES = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const
