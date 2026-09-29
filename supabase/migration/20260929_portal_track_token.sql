-- 20260929_portal_track_token.sql
-- Portal customers get a live-tracker token for their OWN shipment's booking.
-- Access is checked through portal_shipments (active portal user, own account only).
-- Reuses an existing valid link where possible so tokens don't pile up.
create or replace function public.portal_track_token(p_job_unique bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking uuid;
  v_token text;
begin
  if public.my_account_id() is null then
    return null;
  end if;
  if not exists (select 1 from public.portal_shipments where job_unique = p_job_unique) then
    return null;
  end if;

  select b.id into v_booking
    from public.bookings b
   where b.shipment_id = p_job_unique
     and b.archived_at is null
     and b.mode = 'sea_import'
   order by b.updated_at desc
   limit 1;
  if v_booking is null then
    return null;
  end if;

  select l.token into v_token
    from public.booking_share_links l
   where l.booking_id = v_booking
     and l.revoked_at is null
     and l.expires_at > now() + interval '7 days'
   order by l.expires_at desc
   limit 1;
  if v_token is not null then
    return v_token;
  end if;

  insert into public.booking_share_links (token, booking_id, created_by, expires_at)
  values (translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'), v_booking, auth.uid(), now() + interval '90 days')
  returning token into v_token;
  return v_token;
end $$;

revoke all on function public.portal_track_token(bigint) from public, anon;
grant execute on function public.portal_track_token(bigint) to authenticated;
