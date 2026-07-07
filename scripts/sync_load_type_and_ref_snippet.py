"""
Pending sync additions for sync_to_supabase.py (Customer Portal folder).

LOAD TYPE — Firebird source
  FIS_JOB.FCL  (sea imports)
  FES_JOB.FCL  (sea exports)

Observed values in UBNZ.FDB:
  Y  → FCL  (FIS: 7,744 · FES: 3,035)
  N  → LCL  (FIS: 4,043 · FES: 22,227)
  A, R, B, X, NULL → unmapped (confirm with ops before mapping)

Supabase target: shipments.load_type  ('LCL' | 'FCL' | null)


CUSTOMER REFERENCE — Firebird source
  Primary table: FRT_REFERENCE
    Columns: DEPARTMENT, JOB, REFERENCE, FLAG, DATE1, ID
    Join: FRT_REFERENCE.JOB = {module}_JOB.JOB  (job number, NOT job_unique)

  Module coverage in UBNZ.FDB:
    FES: FRT_REFERENCE (489 jobs) + FES_JOB.BOOKING_REF (14,191 jobs — prefer COALESCE)
    FIS: FRT_REFERENCE = 0 matches · FIS_SHIPMENT.REFERENCE empty · FRT_CONSIGNEE empty
    FIA/FEA: no FRT_REFERENCE matches

  Recommended sync:
    FES → COALESCE(ref.REFERENCE, j.BOOKING_REF)
    FIS → NULL until import reference source confirmed

Supabase target: shipments.customer_ref
"""

from __future__ import annotations


def map_load_type(fcl: str | None) -> str | None:
    v = (fcl or "").strip().upper()
    if v == "Y":
        return "FCL"
    if v == "N":
        return "LCL"
    return None


# In MODULES loop SELECT, add for sea modules:
#   jc("FCL")   — only when "FCL" in jcols
#
# In ship_rows dict:
#   load_type=map_load_type(fcl) if M["mode"] == "sea" else None,
#
# Optional LEFT JOIN for FES reference:
#   LEFT JOIN "FRT_REFERENCE" ref ON ref."JOB" = j."JOB"
#   customer_ref=clean(refval) or clean(booking_ref)
