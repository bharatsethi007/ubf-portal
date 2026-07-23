-- Expose PortConnect last sync on Import Sea board for source tooltips
DROP FUNCTION IF EXISTS public.get_import_sea_board();

CREATE OR REPLACE FUNCTION public.get_import_sea_board()
 RETURNS TABLE(
  id uuid, booking_ref text, job_no text, customer_id text, customer_name text,
  eta date, eta_source text, atf text, atf_source text, shipping_line text,
  shipping_line_source text, discharge_port text, discharge_port_source text,
  swb_released boolean, tlx_release_on_hand boolean, doc_handover_at timestamp with time zone,
  bacc_sent boolean, cleared boolean, truck_booked boolean, last_free_day date,
  last_free_day_source text, discharge_date date, discharge_date_source text,
  delivery_date date, delivery_date_source text, container_return_date date,
  hold_reason text, hold_code text, hold_label text, handled_by uuid,
  handler_name text, handler_initials text, discharge_comment text, containers jsonb,
  matched boolean, erp_ref_confirmed_at timestamp with time zone,
  port_cleared boolean, line_released boolean,
  port_clearance_cancelled boolean, line_release_cancelled boolean,
  portconnect_last_sync timestamp with time zone
 )
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    b.id,
    b.booking_ref,
    b.job_no,
    cust.account_id AS customer_id,
    cust.name AS customer_name,
    COALESCE(pc.eta, s.eta, b.m_eta) AS eta,
    CASE
      WHEN pc.eta IS NOT NULL THEN 'portconnect'
      WHEN s.eta IS NOT NULL THEN 'shipment'
      WHEN b.m_eta IS NOT NULL THEN 'manual'
      ELSE NULL
    END AS eta_source,
    COALESCE(pc.atf, s.arrived::text, b.m_atf) AS atf,
    CASE
      WHEN pc.atf IS NOT NULL THEN 'portconnect'
      WHEN s.arrived IS NOT NULL THEN 'shipment'
      WHEN b.m_atf IS NOT NULL THEN 'manual'
      ELSE NULL
    END AS atf_source,
    COALESCE(pc.shipping_line, b.m_shipping_line) AS shipping_line,
    CASE
      WHEN pc.shipping_line IS NOT NULL THEN 'portconnect'
      WHEN b.m_shipping_line IS NOT NULL THEN 'manual'
      ELSE NULL
    END AS shipping_line_source,
    COALESCE(pc.discharge_port, s.destination, b.m_discharge_port) AS discharge_port,
    CASE
      WHEN pc.discharge_port IS NOT NULL THEN 'portconnect'
      WHEN s.destination IS NOT NULL THEN 'shipment'
      WHEN b.m_discharge_port IS NOT NULL THEN 'manual'
      ELSE NULL
    END AS discharge_port_source,
    b.swb_released,
    b.tlx_release_on_hand,
    b.doc_handover_at,
    b.bacc_sent,
    b.cleared,
    b.truck_booked,
    COALESCE(pc.last_free_day, b.last_free_day) AS last_free_day,
    CASE
      WHEN pc.last_free_day IS NOT NULL THEN 'portconnect'
      WHEN b.last_free_day IS NOT NULL THEN 'manual'
      ELSE NULL
    END AS last_free_day_source,
    COALESCE(pc.discharge_date, b.discharge_date) AS discharge_date,
    CASE
      WHEN pc.discharge_date IS NOT NULL THEN 'portconnect'
      WHEN b.discharge_date IS NOT NULL THEN 'manual'
      ELSE NULL
    END AS discharge_date_source,
    COALESCE(pc.delivery_date, b.delivery_date) AS delivery_date,
    CASE
      WHEN pc.delivery_date IS NOT NULL THEN 'portconnect'
      WHEN b.delivery_date IS NOT NULL THEN 'manual'
      ELSE NULL
    END AS delivery_date_source,
    b.container_return_date,
    b.hold_reason,
    b.hold_code,
    hr.label AS hold_label,
    b.handled_by,
    CASE
      WHEN handler.user_id IS NULL THEN NULL
      ELSE split_part(handler.email, '@', 1)
    END AS handler_name,
    CASE
      WHEN handler.user_id IS NULL THEN NULL
      ELSE public.staff_initials(handler.initials, split_part(handler.email, '@', 1))
    END AS handler_initials,
    b.discharge_comment,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'container_no', bc.container_no,
          'container_type', COALESCE(ct.container_type, bc.container_type),
          'iso_type', ct.iso_type,
          'iso_desc', ct.iso_desc,
          'source', bc.source,
          'conflict_status', bc.conflict_status,
          'erp_container_type', bc.erp_container_type,
          'resolved_at', bc.resolved_at,
          'hazard_count', COALESCE(ct.hazard_count, 0),
          'hazards', COALESCE(ct.hazards, '[]'::jsonb)
        )
        ORDER BY bc.sort_order, bc.container_no
      )
      FROM public.booking_containers bc
      LEFT JOIN public.container_tracking ct
        ON ct.booking_id = bc.booking_id AND upper(ct.container_no) = upper(bc.container_no)
      WHERE bc.booking_id = b.id
    ), '[]'::jsonb) AS containers,
    (b.shipment_id IS NOT NULL) AS matched,
    b.erp_ref_confirmed_at,
    COALESCE(pc.port_cleared, false) AS port_cleared,
    COALESCE(pc.line_released, false) AS line_released,
    COALESCE(cancel.port_clearance_cancelled, false) AS port_clearance_cancelled,
    COALESCE(cancel.line_release_cancelled, false) AS line_release_cancelled,
    bt.last_portconnect_sync AS portconnect_last_sync
  FROM public.bookings b
  LEFT JOIN public.shipments s ON s.job_unique = b.shipment_id
  LEFT JOIN public.customers cust ON cust.account_id = b.account_id
  LEFT JOIN public.hold_reasons hr ON hr.code = b.hold_code
  LEFT JOIN public.staff_users handler ON handler.user_id = b.handled_by
  LEFT JOIN public.booking_tracking bt ON bt.booking_id = b.id
  LEFT JOIN LATERAL (
    SELECT
      (MIN(ct.inbound_eta))::date AS eta,
      to_char(MIN(ct.inbound_ata) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS atf,
      NULLIF(trim(MAX(ct.operator_name)), '') AS shipping_line,
      NULLIF(trim(MAX(ct.discharge_port_name)), '') AS discharge_port,
      (MIN(ct.last_free_at))::date AS last_free_day,
      (MIN(ct.discharged_at))::date AS discharge_date,
      (MIN(ct.delivered_at))::date AS delivery_date,
      COALESCE(BOOL_AND(ct.customs_release_at IS NOT NULL AND ct.mpi_release_at IS NOT NULL), false) AS port_cleared,
      COALESCE(BOOL_AND(ct.line_release_at IS NOT NULL), false) AS line_released
    FROM public.container_tracking ct
    WHERE ct.booking_id = b.id
  ) pc ON true
  LEFT JOIN LATERAL (
    SELECT
      bool_or(te.event_type_code IN ('CUSTOMSRELEASECANCELLED', 'MPIRELEASECANCELLED')) AS port_clearance_cancelled,
      bool_or(te.event_type_code = 'LOPRELEASECANCELLED') AS line_release_cancelled
    FROM public.tracking_events te
    WHERE te.booking_id = b.id AND te.source = 'portconnect'
  ) cancel ON true
  WHERE b.mode = 'sea_import'
  ORDER BY COALESCE(pc.eta, s.eta, b.m_eta) NULLS LAST;
$function$;
