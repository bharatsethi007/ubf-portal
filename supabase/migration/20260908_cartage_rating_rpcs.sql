-- applied to DB 8 Sep 2026 via MCP. Idempotent parity file — do not re-run.
-- Cartage rating engine: resolve_cartage_zone + cartage_rate_quote. Staff-gated.
-- resolve_cartage_zone(postcode, city, raw) -> (zone_id, confidence green/amber/red)
--   ladder: postcode exact -> postcode_range -> suburb/city -> cartage_aliases -> null(red)
-- cartage_rate_quote(door_postcode, door_city, door_raw, port_code, direction, mode,
--   weight_kg, cbm, volume_cm3, residential, tail_lift, as_of) -> jsonb breakdown
--   mode: 'fcl20'|'fcl40'|'lcl'|'air'. Resolves door zone from address, port zone from UN/LOCODE.
--   direction export = door->port, import = port->door. Picks cheapest applicable active/validated
--   card+lane valid for as_of. FCL: flat base floored at min + heavy tier by weight.
--   LCL: max(per_cbm*cbm, band_per_kg*weight) floor min. Air: max(actual, vol/6000)*band_per_kg floor min.
--   Then FAF% (latest month) on base + tail lift + residential (flat). See project memory for full spec.

create or replace function resolve_cartage_zone(p_postcode text, p_city text, p_raw text)
returns table(zone_id uuid, confidence text)
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  if p_postcode is not null and p_postcode <> '' then
    select m.zone_id into v from cartage_zone_members m
      where m.match_type = 'postcode' and lower(m.value) = lower(p_postcode) limit 1;
    if v is not null then return query select v, 'green'::text; return; end if;
    if p_postcode ~ '^[0-9]+$' then
      select m.zone_id into v from cartage_zone_members m
        where m.match_type = 'postcode_range'
          and m.value ~ '^[0-9]+$' and (m.value_to is null or m.value_to ~ '^[0-9]+$')
          and p_postcode::int >= m.value::int
          and (m.value_to is null or p_postcode::int <= m.value_to::int)
        order by (coalesce(m.value_to, m.value)::int - m.value::int) asc limit 1;
      if v is not null then return query select v, 'green'::text; return; end if;
    end if;
  end if;
  if p_city is not null and p_city <> '' then
    select m.zone_id into v from cartage_zone_members m
      where m.match_type in ('suburb','city') and lower(m.value) = lower(p_city) limit 1;
    if v is not null then return query select v, 'green'::text; return; end if;
  end if;
  select a.zone_id into v from cartage_aliases a
    where lower(a.raw) in (lower(coalesce(p_raw,'')), lower(coalesce(p_city,'')), lower(coalesce(p_postcode,'')))
      and coalesce(p_raw,p_city,p_postcode,'') <> '' limit 1;
  if v is not null then return query select v, 'amber'::text; return; end if;
  return query select null::uuid, 'red'::text;
end $$;

grant execute on function resolve_cartage_zone(text,text,text) to authenticated;

create or replace function cartage_rate_quote(
  p_door_postcode text default null,
  p_door_city text default null,
  p_door_raw text default null,
  p_port_code text default null,
  p_direction text default 'export',
  p_mode text default 'lcl',
  p_weight_kg numeric default 0,
  p_cbm numeric default 0,
  p_volume_cm3 numeric default 0,
  p_residential boolean default false,
  p_tail_lift boolean default false,
  p_as_of date default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_as_of date := coalesce(p_as_of, current_date);
  v_door uuid; v_door_conf text; v_port uuid; v_origin uuid; v_dest uuid;
  v_is_fcl boolean := p_mode in ('fcl20','fcl40');
  v_size text := case when p_mode = 'fcl20' then '20' when p_mode = 'fcl40' then '40' else null end;
  v_chargeable_kg numeric := 0;
  v_base numeric := 0; v_min numeric := 0; v_per_cbm numeric := 0; v_per_kg numeric := 0;
  v_faf numeric := 0; v_heavy numeric := 0; v_tail numeric := 0; v_resi numeric := 0;
  v_faf_amt numeric := 0; v_wcost numeric := 0; v_ccost numeric := 0;
  v_vendor text; v_card uuid; v_band_code text;
  v_surcharges jsonb := '[]'::jsonb;
  v_warnings text[] := '{}';
  v_total numeric := 0;
  v_fcl record; v_lane record; v_band record;
begin
  if not is_staff() then return jsonb_build_object('error','forbidden'); end if;

  select r.zone_id, r.confidence into v_door, v_door_conf from resolve_cartage_zone(p_door_postcode, p_door_city, p_door_raw) r;
  select id into v_port from cartage_zones
    where upper(zone_code) = upper(coalesce(p_port_code,'')) and zone_type in ('port','depot') and active limit 1;

  if p_direction = 'import' then v_origin := v_port; v_dest := v_door;
  else v_origin := v_door; v_dest := v_port; end if;

  if v_door is null then v_warnings := array_append(v_warnings, 'door address did not resolve to a zone'); end if;
  if v_port is null then v_warnings := array_append(v_warnings, 'port code did not resolve to a port/depot zone'); end if;
  if v_origin is null or v_dest is null then
    return jsonb_build_object('status','no_zone','door_zone_id',v_door,'door_confidence',v_door_conf,'port_zone_id',v_port,'warnings',to_jsonb(v_warnings));
  end if;

  if v_is_fcl then
    select f.base_rate as base_rate, f.min_charge as min_charge, rc.vendor_name as vendor_name, rc.id as card_id
      into v_fcl
    from rate_card_cartage_fcl_lines f
    join rate_cards rc on rc.id = f.rate_card_id
    where rc.rate_type = 'cartage' and rc.status in ('active','validated')
      and (rc.valid_from is null or rc.valid_from <= v_as_of)
      and (rc.valid_to is null or rc.valid_to >= v_as_of)
      and f.direction = p_direction and f.origin_zone_id = v_origin and f.dest_zone_id = v_dest and f.container_size = v_size
    order by f.base_rate asc nulls last, rc.valid_from desc nulls last limit 1;
    if not found then
      return jsonb_build_object('status','no_lane','warnings',to_jsonb(array_append(v_warnings,'no FCL rate for this lane/size')),'door_zone_id',v_door,'port_zone_id',v_port);
    end if;
    v_base := greatest(coalesce(v_fcl.base_rate,0), coalesce(v_fcl.min_charge,0));
    v_vendor := v_fcl.vendor_name; v_card := v_fcl.card_id;
    select coalesce(max(t.amount),0) into v_heavy
      from cartage_surcharges s join cartage_surcharge_tiers t on t.surcharge_id = s.id
      where s.code = 'FCL_HEAVY' and s.active and p_weight_kg >= t.threshold_kg;
    if v_heavy > 0 then v_surcharges := v_surcharges || jsonb_build_object('code','FCL_HEAVY','label','Heavy container','amount',v_heavy); end if;
    v_total := v_base + v_heavy;
    return jsonb_build_object('status','ok','mode',p_mode,'vendor',v_vendor,'rate_card_id',v_card,
      'origin_zone_id',v_origin,'dest_zone_id',v_dest,'door_confidence',v_door_conf,
      'base',v_base,'surcharges',v_surcharges,'total',v_total,'warnings',to_jsonb(v_warnings));
  else
    select l.id as lane_id, l.per_cbm as per_cbm, l.min_charge as min_charge, l.rate_card_id as rate_card_id
      into v_lane
    from rate_card_cartage_ltl_lanes l
    join rate_cards rc on rc.id = l.rate_card_id
    where rc.rate_type = 'cartage' and rc.status in ('active','validated')
      and (rc.valid_from is null or rc.valid_from <= v_as_of)
      and (rc.valid_to is null or rc.valid_to >= v_as_of)
      and l.direction = p_direction and l.origin_zone_id = v_origin and l.dest_zone_id = v_dest
    order by coalesce(l.min_charge,0) asc limit 1;
    if not found then
      return jsonb_build_object('status','no_lane','warnings',to_jsonb(array_append(v_warnings,'no LTL lane for this route')),'door_zone_id',v_door,'port_zone_id',v_port);
    end if;
    select rc.vendor_name, rc.id into v_vendor, v_card from rate_cards rc where rc.id = v_lane.rate_card_id;

    if p_mode = 'air' then v_chargeable_kg := greatest(coalesce(p_weight_kg,0), coalesce(p_volume_cm3,0)/6000.0);
    else v_chargeable_kg := coalesce(p_weight_kg,0); end if;

    select b.band_code as band_code, br.per_kg as per_kg into v_band
      from cartage_weight_bands b
      join rate_card_cartage_ltl_band_rates br on br.band_id = b.id and br.lane_id = v_lane.lane_id
      where b.active and v_chargeable_kg >= b.min_kg and (b.max_kg is null or v_chargeable_kg < b.max_kg)
      order by b.sort_order limit 1;
    v_per_kg := coalesce(v_band.per_kg,0); v_band_code := v_band.band_code;
    v_per_cbm := coalesce(v_lane.per_cbm,0);
    v_wcost := v_per_kg * v_chargeable_kg;
    v_ccost := v_per_cbm * coalesce(p_cbm,0);
    if p_mode = 'lcl' then v_base := greatest(v_wcost, v_ccost); else v_base := v_wcost; end if;
    v_min := coalesce(v_lane.min_charge,0);
    if v_base < v_min then v_base := v_min; end if;

    select percent into v_faf from cartage_faf where effective_month <= v_as_of order by effective_month desc limit 1;
    v_faf := coalesce(v_faf,0);
    v_faf_amt := round(v_base * v_faf/100.0, 2);
    if v_faf_amt <> 0 then v_surcharges := v_surcharges || jsonb_build_object('code','LTL_FAF','label','FAF '||v_faf||'%','amount',v_faf_amt); end if;

    if p_tail_lift then
      select coalesce(default_amount,0) into v_tail from cartage_surcharges where code='LTL_TAILLIFT' and active limit 1;
      if coalesce(v_tail,0) > 0 then v_surcharges := v_surcharges || jsonb_build_object('code','LTL_TAILLIFT','label','Tail lift','amount',v_tail); end if;
    end if;
    if p_residential then
      select coalesce(default_amount,0) into v_resi from cartage_surcharges where code='LTL_RESI' and active limit 1;
      if coalesce(v_resi,0) > 0 then v_surcharges := v_surcharges || jsonb_build_object('code','LTL_RESI','label','Residential','amount',v_resi); end if;
    end if;

    v_total := v_base + v_faf_amt + coalesce(v_tail,0) + coalesce(v_resi,0);
    return jsonb_build_object('status','ok','mode',p_mode,'vendor',v_vendor,'rate_card_id',v_card,
      'origin_zone_id',v_origin,'dest_zone_id',v_dest,'door_confidence',v_door_conf,
      'chargeable_kg',v_chargeable_kg,'band',v_band_code,'per_kg',v_per_kg,'per_cbm',v_per_cbm,
      'base',v_base,'surcharges',v_surcharges,'total',v_total,'warnings',to_jsonb(v_warnings));
  end if;
end $$;

grant execute on function cartage_rate_quote(text,text,text,text,text,text,numeric,numeric,numeric,boolean,boolean,date) to authenticated;

notify pgrst, 'reload schema';
