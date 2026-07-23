"""
Paste into sync_to_supabase.py — after match_bookings_to_shipments().

Reconciles ERP container numbers on matched bookings against booking_containers.
Never deletes or overwrites manual rows. Never changes container_no on manual rows.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def normalize_container_no(value: str | None) -> str:
    return (value or "").replace(" ", "").upper()


def erp_size_to_type(size: str | None) -> str | None:
    if not size:
        return None
    s = size.strip().upper()
    if s == "20":
        return "20GP"
    if s == "40":
        return "40GP"
    if s in ("40HC", "45"):
        return "40HC"
    return s


def types_match(manual_type: str | None, erp_type: str | None) -> bool:
    if not manual_type or not erp_type:
        return True
    return manual_type.strip().upper() == erp_type.strip().upper()


def stamp_conflict_detected(existing: dict[str, Any], next_status: str) -> str | None:
    if next_status == "none":
        return existing.get("conflict_detected_at")
    if existing.get("conflict_status") == next_status and existing.get("conflict_detected_at"):
        return existing["conflict_detected_at"]
    if existing.get("resolved_at"):
        return existing.get("conflict_detected_at")
    return datetime.now(timezone.utc).isoformat()


def reconcile_booking_containers(
    supabase,
    booking_id: str,
    consol_key: str,
) -> int:
    """Return number of conflicts raised/updated on this booking."""
    erp_resp = (
        supabase.table("containers")
        .select("c_number, container_size, seal")
        .eq("consol_key", consol_key)
        .execute()
    )
    erp_rows = erp_resp.data or []
    erp_map: dict[str, dict[str, Any]] = {}
    for row in erp_rows:
        no = normalize_container_no(row.get("c_number"))
        if not no:
            continue
        erp_map[no] = {
            "container_no": no,
            "container_type": erp_size_to_type(row.get("container_size")),
            "seal_no": (row.get("seal") or "").strip() or None,
        }

    bc_resp = (
        supabase.table("booking_containers")
        .select("*")
        .eq("booking_id", booking_id)
        .execute()
    )
    booking_rows = bc_resp.data or []
    manual_by_no = {
        normalize_container_no(r["container_no"]): r
        for r in booking_rows
        if r.get("source") == "manual"
    }
    existing_by_no = {
        normalize_container_no(r["container_no"]): r for r in booking_rows
    }

    conflicts = 0

    for no, manual in manual_by_no.items():
        if manual.get("resolved_at"):
            continue
        erp = erp_map.get(no)
        if not erp:
            next_status = "manual_only"
            patch = {
                "conflict_status": next_status,
                "erp_container_no": None,
                "erp_container_type": None,
                "conflict_detected_at": stamp_conflict_detected(manual, next_status),
            }
        elif not types_match(manual.get("container_type"), erp["container_type"]):
            next_status = "type_mismatch"
            patch = {
                "conflict_status": next_status,
                "erp_container_no": no,
                "erp_container_type": erp["container_type"],
                "conflict_detected_at": stamp_conflict_detected(manual, next_status),
            }
        else:
            next_status = "none"
            patch = {
                "conflict_status": "none",
                "erp_container_no": no,
                "erp_container_type": erp["container_type"],
            }
        if next_status != "none":
            conflicts += 1
        supabase.table("booking_containers").update(patch).eq("id", manual["id"]).execute()

    sort_order = len(booking_rows)
    for no, erp in erp_map.items():
        if no in manual_by_no:
            continue
        existing = existing_by_no.get(no)
        if existing:
            if existing.get("resolved_at"):
                continue
            if existing.get("source") == "erp":
                next_status = "erp_only"
                if existing.get("conflict_status") != next_status:
                    conflicts += 1
                supabase.table("booking_containers").update(
                    {
                        "conflict_status": next_status,
                        "erp_container_no": no,
                        "erp_container_type": erp["container_type"],
                        "conflict_detected_at": stamp_conflict_detected(existing, next_status),
                    }
                ).eq("id", existing["id"]).execute()
            continue
        sort_order += 1
        conflicts += 1
        supabase.table("booking_containers").insert(
            {
                "booking_id": booking_id,
                "container_no": no,
                "container_type": erp["container_type"],
                "seal_no": erp["seal_no"],
                "source": "erp",
                "conflict_status": "erp_only",
                "erp_container_no": no,
                "erp_container_type": erp["container_type"],
                "conflict_detected_at": datetime.now(timezone.utc).isoformat(),
                "sort_order": sort_order,
            }
        ).execute()

    return conflicts


def reconcile_all_matched_booking_containers(supabase) -> tuple[int, int]:
    """
    Run after match_bookings_to_shipments().
    Returns (bookings_reconciled, conflicts_raised).
    """
    bookings = (
        supabase.table("bookings")
        .select("id, shipment_id")
        .not_.is_("shipment_id", "null")
        .eq("mode", "sea_import")
        .execute()
    ).data or []

    reconciled = 0
    conflicts = 0
    shipment_cache: dict[int, str | None] = {}

    for booking in bookings:
        shipment_id = booking["shipment_id"]
        if shipment_id not in shipment_cache:
            ship = (
                supabase.table("shipments")
                .select("consol_key")
                .eq("job_unique", shipment_id)
                .maybe_single()
                .execute()
            )
            shipment_cache[shipment_id] = (ship.data or {}).get("consol_key")
        consol_key = shipment_cache[shipment_id]
        if not consol_key:
            continue
        reconciled += 1
        conflicts += reconcile_booking_containers(supabase, booking["id"], consol_key)

    print(f"Container reconciliation: {reconciled} bookings reconciled, {conflicts} conflicts raised")
    return reconciled, conflicts


# In main(), immediately after match_bookings_to_shipments():
#   reconcile_all_matched_booking_containers(supabase)
