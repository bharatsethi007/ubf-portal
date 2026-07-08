import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { BookingExtract, CargoLineExtract } from "./types.ts";
import { CLAUDE_MODEL } from "./types.ts";
import { resolveBookingPorts } from "./iataResolve.ts";

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function dateOnly(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function cbmFromDims(l: number | null, w: number | null, h: number | null): number | null {
  if (l == null || w == null || h == null) return null;
  const v = (l * w * h) / 1_000_000;
  return Number.isFinite(v) ? Math.round(v * 10000) / 10000 : null;
}

function lineCbm(
  line: CargoLineExtract,
  volumeM3: number | null,
  lineCount: number,
  index: number,
): number | null {
  const fromDims = cbmFromDims(num(line.length), num(line.width), num(line.height));
  if (fromDims != null) return fromDims;
  if (volumeM3 == null) return null;
  return lineCount === 1 || index === 0 ? volumeM3 : null;
}

function cargoLineRows(
  bookingId: string,
  lines: CargoLineExtract[],
  volumeM3: number | null,
): Record<string, unknown>[] {
  return lines.map((line, index) => ({
    booking_id: bookingId,
    ord: index,
    pieces: num(line.pieces),
    length_unit: "cm",
    length: num(line.length),
    width: num(line.width),
    height: num(line.height),
    cbm: lineCbm(line, volumeM3, lines.length, index),
    weight_unit: "kg",
    weight: num(line.weight),
    goods_desc: str(line.goods_desc),
  }));
}

export function bookingInsertRow(
  ownerEmail: string | null,
  extracted: BookingExtract,
  rawPayload: BookingExtract,
  ports: { origin: string | null; destination: string | null },
): Record<string, unknown> {
  return {
    module: "EA",
    source: "email_import",
    status: "draft",
    owner_email: ownerEmail,
    importer_name: str(extracted.importer_name),
    origin: ports.origin,
    destination: ports.destination,
    incoterm: str(extracted.incoterm),
    commodity: str(extracted.commodity),
    goods_description: str(extracted.goods_description),
    pieces: num(extracted.pieces),
    weight_kg: num(extracted.weight_kg),
    gross_weight_kg: num(extracted.gross_weight_kg),
    volume_m3: num(extracted.volume_m3),
    chargeable_weight_kg: num(extracted.chargeable_weight_kg),
    packing_type: str(extracted.packing_type),
    shipper_address: str(extracted.shipper_address),
    shipper_city: str(extracted.shipper_city),
    shipper_country: str(extracted.shipper_country),
    shipper_phone: str(extracted.shipper_phone),
    shipper_email: str(extracted.shipper_email),
    consignee_name: str(extracted.consignee_name),
    consignee_address: str(extracted.consignee_address),
    consignee_city: str(extracted.consignee_city),
    consignee_country: str(extracted.consignee_country),
    consignee_phone: str(extracted.consignee_phone),
    consignee_email: str(extracted.consignee_email),
    cargo_ready_date: dateOnly(extracted.cargo_ready_date),
    etd: dateOnly(extracted.etd),
    special_instructions: str(extracted.special_instructions),
    is_dg: extracted.is_dg === true,
    un_number: str(extracted.un_number),
    dg_class: str(extracted.dg_class),
    is_temp_controlled: false,
    is_valuable: false,
    is_oog: false,
    is_consolidation: false,
    extraction_confidence: {
      low_confidence: extracted._low_confidence ?? [],
      extracted_at: new Date().toISOString(),
      model: CLAUDE_MODEL,
    },
    source_payload: rawPayload,
  };
}

export async function writeDraft(
  db: SupabaseClient,
  sourceEmailId: string,
  ownerEmail: string | null,
  extracted: BookingExtract,
  rawPayload: BookingExtract,
): Promise<string> {
  const ports = await resolveBookingPorts(db, extracted.origin, extracted.destination);
  const lowConfidence = [...(extracted._low_confidence ?? [])];
  for (const field of ports.unresolved) {
    if (!lowConfidence.includes(field)) lowConfidence.push(field);
  }
  const enriched: BookingExtract = { ...extracted, _low_confidence: lowConfidence };

  const { data: booking, error: bkErr } = await db
    .from("bookings")
    .insert(bookingInsertRow(ownerEmail, enriched, rawPayload, ports))
    .select("id, booking_ref")
    .single();
  if (bkErr || !booking) throw new Error(bkErr?.message ?? "booking insert failed");

  const lines = (enriched.cargo_lines ?? []).filter(Boolean);
  const volumeM3 = num(enriched.volume_m3);
  if (lines.length > 0) {
    const { error: clErr } = await db.from("booking_cargo_lines").insert(
      cargoLineRows(booking.id as string, lines, volumeM3),
    );
    if (clErr) throw new Error(clErr.message);
  }

  await insertShipperSupplier(db, booking.id as string, enriched.shipper_name);

  const { error: upErr } = await db.from("booking_source_emails").update({
    booking_id: booking.id,
    processing_status: "extracted",
    error_detail: null,
  }).eq("id", sourceEmailId);
  if (upErr) throw new Error(upErr.message);

  return booking.id as string;
}

async function insertShipperSupplier(
  db: SupabaseClient,
  bookingId: string,
  shipperName: string | null,
): Promise<void> {
  const name = str(shipperName);
  if (!name) return;
  const { error } = await db.from("booking_suppliers").insert({
    booking_id: bookingId,
    ord: 0,
    supplier_name: name,
  });
  if (error) throw new Error(error.message);
}

export async function markSourceRetry(
  db: SupabaseClient,
  sourceEmailId: string,
  detail: string,
): Promise<void> {
  await db.from("booking_source_emails").update({
    error_detail: detail.slice(0, 4000),
  }).eq("id", sourceEmailId);
}

export async function markSourceFailed(
  db: SupabaseClient,
  sourceEmailId: string,
  detail: string,
): Promise<void> {
  await db.from("booking_source_emails").update({
    processing_status: "failed",
    error_detail: detail.slice(0, 4000),
  }).eq("id", sourceEmailId);
}
