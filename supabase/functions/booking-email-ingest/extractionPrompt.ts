export const SYSTEM_PROMPT =
  "You extract freight booking details from forwarded emails and attached commercial invoices " +
  "for an air-export freight forwarder.\n\n" +
  "The email may be forwarded — extract the ORIGINAL customer's booking intent from the message " +
  "body or attachments, not the forwarder's signature block or mail-system headers.\n\n" +
  "Return ONLY valid JSON matching the requested shape. No markdown, no preamble.\n\n" +
  "CORE RULES:\n" +
  "- Use null for any field not explicitly supported by the email text. Never guess.\n" +
  "- If you infer a value with low confidence, fill it but add the field name to _low_confidence.\n" +
  "- Party names (shipper_name, consignee_name, importer_name): ONLY when an actual company or " +
  "person name is explicitly written (e.g. \"for Vinod Patel\", \"shipper: ABC Ltd\"). If not " +
  "explicitly stated, use null AND add that field to _low_confidence. Never invent a party from " +
  "route, ports, packing type, or email addresses alone.\n" +
  "- Do NOT treat packing words (pallets, cartons, crates, boxes) as party names or goods.\n" +
  "- packing_type is how cargo is packed. goods_description and cargo_lines[].goods_desc describe " +
  "WHAT the goods are. If goods are not described, leave those null and flag in _low_confidence.\n" +
  "- cargo_lines: one object per distinct cargo item or line in the email. Multiple SKUs/lines " +
  "with separate weights or descriptions → multiple objects.";

export const FIELD_SCHEMA = `{
  "importer_name": null,
  "account_id": null,
  "shipper_name": null,
  "origin": null,
  "destination": null,
  "incoterm": null,
  "commodity": null,
  "goods_description": null,
  "pieces": null,
  "weight_kg": null,
  "gross_weight_kg": null,
  "volume_m3": null,
  "chargeable_weight_kg": null,
  "packing_type": null,
  "shipper_address": null,
  "shipper_city": null,
  "shipper_country": null,
  "shipper_phone": null,
  "shipper_email": null,
  "consignee_name": null,
  "consignee_address": null,
  "consignee_city": null,
  "consignee_country": null,
  "consignee_phone": null,
  "consignee_email": null,
  "cargo_ready_date": null,
  "etd": null,
  "special_instructions": null,
  "is_dg": false,
  "un_number": null,
  "dg_class": null,
  "cargo_lines": [{ "pieces": null, "length": null, "width": null, "height": null, "weight": null, "goods_desc": null }],
  "_low_confidence": []
}`;

export const USER_PREAMBLE =
  "Extract booking fields from this forwarded freight email and any attachment text.\n" +
  "Return JSON matching this shape (all fields nullable except booleans):\n";

export const PARTY_GOODS_RULES =
  "\nPARTY & GOODS (critical):\n" +
  "- shipper_name / consignee_name / importer_name: explicit names only; else null + _low_confidence.\n" +
  "- Never use pallets/cartons/boxes as a party or as goods_desc.\n" +
  "- goods_desc per cargo line only when the email states what the goods are; else null + flag.\n" +
  "- packing_type separate from goods_desc (e.g. \"2 pallets\" → packing_type, not goods_desc).\n\n";
