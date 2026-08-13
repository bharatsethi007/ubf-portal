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

// The four maritime terms (FAS/FOB/CFR/CIF) are valid only for sea / inland waterway.
// Air (and any non-waterway mode) uses the seven "any mode of transport" terms.
export const AIR_INCOTERM_CODES = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const
