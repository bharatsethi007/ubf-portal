"""
Paste into sync_to_supabase.py — container ISO size from Firebird FRT_CONTAINER.C_TYPE.

Source column (TradeWindow / Firebird):
  FRT_CONTAINER.C_TYPE  — ISO equipment type code (e.g. 20GP, 40GP, 40HC, 22G1, 42G1, 45G1)

Join path (unchanged from existing container sync):
  FRT_CONTAINER links to consol via MODULE + SHIPMENT_NO (same as current c_number pull).

Supabase target:
  containers.container_size  text  CHECK IN ('20', '40', '40HC')
"""

from __future__ import annotations


def map_container_size(c_type: str | None) -> str | None:
    if not c_type:
        return None
    code = c_type.strip().upper().replace("'", "")
    if not code:
        return None
    if code.startswith("20") or code in ("22G1", "22GP", "20GP", "20HC"):
        return "20"
    if code.startswith("40HC") or code.startswith("45") or code in ("45G1", "45GP", "40HQ"):
        return "40HC"
    if code.startswith("40") or code in ("42G1", "42GP", "40GP"):
        return "40"
    # Fallback: leading digits
    if code[:2] == "20":
        return "20"
    if code[:2] in ("40", "42", "45"):
        return "40HC" if "HC" in code or "HQ" in code or code[:2] == "45" else "40"
    return None


# Example SELECT fragment — merge with your existing FRT_CONTAINER query:
#
#   SELECT
#     fc.C_NUMBER,
#     fc.C_TYPE,          -- <-- add this column
#     fc.MODULE,
#     fc.SHIPMENT_NO,
#     ...
#   FROM FRT_CONTAINER fc
#
# Upsert payload per row:
#
#   {
#     ...
#     "container_size": map_container_size(row["C_TYPE"]),
#   }
