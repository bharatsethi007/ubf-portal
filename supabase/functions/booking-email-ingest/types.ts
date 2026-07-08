export const MAILBOX = "Bookings.AI@ubfreight.com";
export const BUCKET = "booking-emails";
export const CLAUDE_MODEL = "claude-sonnet-4-6";

export type GraphAddress = { emailAddress?: { name?: string; address?: string } };

export type GraphBody = { contentType?: string; content?: string };

export type GraphAttachment = {
  id: string;
  name?: string;
  contentType?: string;
  size?: number;
  "@odata.type"?: string;
  contentBytes?: string;
};

export type GraphMessage = {
  id: string;
  subject?: string;
  receivedDateTime?: string;
  from?: GraphAddress;
  body?: GraphBody;
  attachments?: GraphAttachment[];
};

export type CargoLineExtract = {
  pieces?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  weight?: number | null;
  goods_desc?: string | null;
};

export type BookingExtract = {
  importer_name?: string | null;
  account_id?: string | null;
  shipper_name?: string | null;
  origin?: string | null;
  destination?: string | null;
  incoterm?: string | null;
  commodity?: string | null;
  goods_description?: string | null;
  pieces?: number | null;
  weight_kg?: number | null;
  gross_weight_kg?: number | null;
  volume_m3?: number | null;
  chargeable_weight_kg?: number | null;
  packing_type?: string | null;
  shipper_address?: string | null;
  shipper_city?: string | null;
  shipper_country?: string | null;
  shipper_phone?: string | null;
  shipper_email?: string | null;
  consignee_name?: string | null;
  consignee_address?: string | null;
  consignee_city?: string | null;
  consignee_country?: string | null;
  consignee_phone?: string | null;
  consignee_email?: string | null;
  cargo_ready_date?: string | null;
  etd?: string | null;
  special_instructions?: string | null;
  is_dg?: boolean | null;
  un_number?: string | null;
  dg_class?: string | null;
  cargo_lines?: CargoLineExtract[] | null;
  _low_confidence?: string[] | null;
};

export type SourceEmailRow = {
  id: string;
  message_id: string | null;
  processing_status: string;
};
