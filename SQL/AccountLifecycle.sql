-- Apply after the existing SQL scripts, using the Supabase SQL Editor (postgres).
-- No account is archived on installation. Existing members receive a six-month grace period.
begin;

create table if not exists public.portal_accounts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','dormant','graduated','withdrawn')),
  last_active_at timestamptz not null default now(),
  activity_recorded boolean not null default false,
  warning_at timestamptz,
  status_changed_at timestamptz not null default now(),
  status_changed_by uuid,
  reason text not null default '' check (length(reason) <= 500)
);
create index if not exists portal_accounts_inactivity on public.portal_accounts(last_active_at) where status = 'active';
insert into public.portal_accounts(profile_id) select id from public.profiles on conflict do nothing;

create table if not exists public.portal_account_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null,
  actor_id uuid,
  previous_status text not null,
  status text not null,
  reason text not null,
  previous_privileges jsonb,
  created_at timestamptz not null default now()
);
alter table public.portal_accounts enable row level security;
alter table public.portal_account_events enable row level security;
revoke all on public.portal_accounts, public.portal_account_events from anon, authenticated;
grant select (profile_id, status) on public.portal_accounts to authenticated;
grant all on public.portal_accounts, public.portal_account_events to service_role;
grant usage, select on sequence public.portal_account_events_id_seq to service_role;
drop policy if exists portal_accounts_read on public.portal_accounts;
create policy portal_accounts_read on public.portal_accounts for select to authenticated using (true);

-- Fix the existing role trigger: returning NEW on DELETE silently cancels deletion.
create or replace function public.block_admin_role_changes()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.leader = 'Administrator'::leader_role then
      raise exception 'Administrator role cannot be edited via client.';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.leader = 'Administrator'::leader_role or new.leader = 'Administrator'::leader_role then
      raise exception 'Administrator role cannot be edited via client.';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.leader = 'Administrator'::leader_role then
      raise exception 'Administrator role cannot be edited via client.';
    end if;
    return old;
  end if;

  return new;
end;
$$;


-- SECURITY DEFINER avoids policy recursion. Never trust user-editable metadata.
create or replace function public.portal_account_is_active(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id is not null and not exists (
    select 1 from public.portal_accounts where profile_id = p_user_id and status <> 'active'
  );
$$;

create or replace function public.portal_user_has_access(p_user_id uuid, p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.portal_account_is_active(p_user_id) and exists (
    select 1 from auth.sessions s join auth.users u on u.id = s.user_id
    where s.id = p_session_id and s.user_id = p_user_id
      and (s.not_after is null or s.not_after > now())
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;
revoke all on function public.portal_user_has_access(uuid,uuid) from public, anon, authenticated;
grant execute on function public.portal_user_has_access(uuid,uuid) to service_role;

create or replace function public.portal_request_has_access()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare session_id uuid;
begin
  if auth.uid() is null then return false; end if;
  begin session_id := (auth.jwt()->>'session_id')::uuid;
  exception when invalid_text_representation then return false; end;
  return public.portal_user_has_access(auth.uid(), session_id);
end;
$$;
revoke all on function public.portal_account_is_active(uuid), public.portal_request_has_access() from public, anon;
grant execute on function public.portal_account_is_active(uuid), public.portal_request_has_access() to authenticated, service_role;

-- PostgREST pre-request covers SECURITY DEFINER RPCs as well as table requests.
create or replace function public.portal_check_access()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() = 'authenticated' and not public.portal_request_has_access() then
    raise sqlstate 'PT403' using message = 'Portal account is inactive or session was revoked';
  end if;
end;
$$;
revoke all on function public.portal_check_access() from public;
grant execute on function public.portal_check_access() to anon, authenticated, service_role;
do $$
declare setting text;
begin
  select option into setting from pg_roles r, unnest(r.rolconfig) option
  where r.rolname = 'authenticator' and option like 'pgrst.db_pre_request=%';
  if setting is not null and setting <> 'pgrst.db_pre_request=public.portal_check_access' then
    raise exception 'Existing db_pre_request hook detected. Merge the access check before applying this migration.';
  end if;
  alter role authenticator set pgrst.db_pre_request = 'public.portal_check_access';
end;
$$;

-- Restrictive policies are ANDed with existing policies; they never broaden access.
-- Re-run this block when adding tables. Public assets remain public; private Storage is covered.
do $$
declare t record;
begin
  for t in select schemaname, tablename, rowsecurity from pg_tables
    where schemaname = 'public' or (schemaname = 'storage' and tablename = 'objects')
  loop
    if not t.rowsecurity then
      -- Preserve the table's previous grant-based access for active clients.
      execute format('create policy portal_existing_table_access on %I.%I for all to public using (true) with check (true)', t.schemaname,t.tablename);
    end if;
    execute format('alter table %I.%I enable row level security', t.schemaname,t.tablename);
    execute format('drop policy if exists portal_active_account on %I.%I',t.schemaname,t.tablename);
    execute format('create policy portal_active_account on %I.%I as restrictive for all to authenticated using ((select public.portal_request_has_access())) with check ((select public.portal_request_has_access()))',t.schemaname,t.tablename);
  end loop;
end;
$$;

create or replace function public.portal_create_account_record()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.portal_accounts(profile_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists portal_create_account_record on public.profiles;
create trigger portal_create_account_record after insert on public.profiles
for each row execute function public.portal_create_account_record();

-- Profile IDs and band membership survive archival. Explicit erasure requires a separate procedure.
create or replace function public.portal_preserve_archived_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.portal_account_is_active(old.id) then
    raise exception 'Archived member history cannot be deleted through account deletion';
  end if;
  return old;
end;
$$;
drop trigger if exists portal_preserve_archived_profile on public.profiles;
create trigger portal_preserve_archived_profile before delete on public.profiles
for each row execute function public.portal_preserve_archived_profile();

-- Remove the former overload so old clients cannot bypass the revision check in the API.
drop function if exists public.portal_set_account_status(uuid,text,uuid,text);
create or replace function public.portal_set_account_status(p_user_id uuid, p_status text, p_actor_id uuid, p_reason text default '', p_expected_changed_at timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
declare previous text; changed_at timestamptz; privileges jsonb; positions jsonb;
begin
  if p_status not in ('active','dormant','graduated','withdrawn') or p_status is null or length(p_reason) > 500 then
    raise exception 'Invalid account status or reason';
  end if;
  -- Serialize status changes and activity updates. Also serialize admin changes to prevent
  -- two concurrent administrators from disabling each other using stale permissions.
  perform pg_advisory_xact_lock(726194021);
  if p_actor_id is not null then
    if p_actor_id = p_user_id then raise exception 'Cannot change your own account status'; end if;
    if not public.portal_account_is_active(p_actor_id) or not public.is_admin_or_supervisor(p_actor_id) then
      raise exception 'Administrator permission required';
    end if;
  end if;
  select status, status_changed_at into previous, changed_at from public.portal_accounts where profile_id = p_user_id for update;
  if not found then raise exception 'Member not found'; end if;
  if p_expected_changed_at is not null and changed_at is distinct from p_expected_changed_at then
    raise exception 'Account was changed by another administrator. Reload before editing.';
  end if;
  if previous = p_status then return; end if;
  select jsonb_build_object('leader',p.leader,'leaders',
    (select coalesce(jsonb_agg(pl.leader),'[]'::jsonb) from public.profile_leaders pl where pl.profile_id = p_user_id))
    into privileges from public.profiles p where p.id = p_user_id;
  if p_status <> 'active' then
    -- Revoke both primary and additional access roles, but retain activity/history tables.
    delete from public.profile_leaders where profile_id = p_user_id;
    update public.profiles set leader = 'none' where id = p_user_id;
    if to_regclass('public.profile_positions') is not null then
      execute 'select coalesce(jsonb_agg(position), ''[]''::jsonb) from public.profile_positions where profile_id = $1'
        into positions using p_user_id;
      -- Positions such as Web Secretary can also grant access. Preserve their previous
      -- values in the audit event and remove the current assignment.
      privileges := privileges || jsonb_build_object('positions', positions);
      execute 'delete from public.profile_positions where profile_id = $1' using p_user_id;
    end if;
    update auth.users set banned_until = now() + interval '100 years' where id = p_user_id;
    delete from auth.sessions where user_id = p_user_id;
  elsif previous <> 'active' then
    update auth.users set banned_until = null where id = p_user_id;
    -- Old access tokens must not work after restoration either.
    delete from auth.sessions where user_id = p_user_id;
  end if;
  update public.portal_accounts set status = p_status, status_changed_at = now(),
    status_changed_by = p_actor_id, reason = coalesce(p_reason,''), warning_at = null,
    activity_recorded = case when p_status = 'active' then false else activity_recorded end,
    last_active_at = case when p_status = 'active' then now() else last_active_at end
    where profile_id = p_user_id;
  insert into public.portal_account_events(profile_id,actor_id,previous_status,status,reason,previous_privileges)
    values (p_user_id,p_actor_id,previous,p_status,coalesce(p_reason,''),privileges);
end;
$$;
revoke all on function public.portal_set_account_status(uuid,text,uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.portal_set_account_status(uuid,text,uuid,text,timestamptz) to service_role;

create or replace function public.portal_touch_activity()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account public.portal_accounts;
begin
  if not public.portal_request_has_access() then raise sqlstate 'PT403' using message = 'Account inactive'; end if;
  select * into account from public.portal_accounts where profile_id = auth.uid() for update;
  if not found then return jsonb_build_object('status','active'); end if;
  if account.status <> 'active' then raise sqlstate 'PT403' using message = 'Account inactive'; end if;
  if not account.activity_recorded or account.last_active_at < now() - interval '15 minutes' or account.warning_at is not null then
    update public.portal_accounts set last_active_at = now(), activity_recorded = true, warning_at = null where profile_id = auth.uid();
  end if;
  return jsonb_build_object('status','active');
end;
$$;
revoke all on function public.portal_touch_activity() from public, anon;
grant execute on function public.portal_touch_activity() to authenticated;

-- Notifications appear in the administrator dashboard. A warning always precedes suspension
-- by at least 30 days, even if the daily scheduler has been offline for months.
create or replace function public.portal_process_inactive_accounts()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account record; warned integer := 0; suspended integer := 0; skipped integer := 0;
begin
  perform pg_advisory_xact_lock(726194021);
  update public.portal_accounts set warning_at = now()
    where status = 'active' and warning_at is null
      and last_active_at + interval '6 months' <= now() + interval '30 days';
  get diagnostics warned = row_count;
  for account in select profile_id from public.portal_accounts
    where status = 'active' and last_active_at + interval '6 months' <= now()
      and warning_at <= now() - interval '30 days' order by profile_id for update skip locked
  loop
    if public.is_admin_or_supervisor(account.profile_id) and not exists (
      select 1 from public.portal_accounts a join auth.users u on u.id = a.profile_id
      where a.profile_id <> account.profile_id and a.status = 'active'
        and (u.banned_until is null or u.banned_until <= now())
        and public.is_admin_or_supervisor(a.profile_id)
    ) then skipped := skipped + 1; continue; end if;
    perform public.portal_set_account_status(account.profile_id,'dormant',null,'6か月以上の未アクセス（30日前の事前警告済み）');
    suspended := suspended + 1;
  end loop;
  return jsonb_build_object('warned',warned,'suspended',suspended,'skipped_last_admin',skipped);
end;
$$;
revoke all on function public.portal_process_inactive_accounts() from public, anon, authenticated;
grant execute on function public.portal_process_inactive_accounts() to service_role;

create or replace function public.portal_block_archived_role_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if tg_table_name = 'profiles' then target := new.id;
  else target := new.profile_id; end if;
  if not public.portal_account_is_active(target) and new.leader::text <> 'none' then
    raise exception 'Restore this member before assigning access roles';
  end if;
  return new;
end;
$$;
drop trigger if exists portal_block_archived_role_assignment on public.profiles;
create trigger portal_block_archived_role_assignment before update on public.profiles
for each row execute function public.portal_block_archived_role_assignment();
drop trigger if exists portal_block_archived_role_assignment on public.profile_leaders;
create trigger portal_block_archived_role_assignment before insert or update on public.profile_leaders
for each row execute function public.portal_block_archived_role_assignment();

create or replace function public.portal_block_archived_position_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.portal_account_is_active(new.profile_id) then
    raise exception 'Restore this member before assigning positions';
  end if;
  return new;
end;
$$;
do $$ begin
  if to_regclass('public.profile_positions') is not null then
    execute 'drop trigger if exists portal_block_archived_position_assignment on public.profile_positions';
    execute 'create trigger portal_block_archived_position_assignment before insert or update on public.profile_positions for each row execute function public.portal_block_archived_position_assignment()';
  end if;
end; $$;

-- Do not let a stale member picker add an archived person to a new band.
create or replace function public.portal_check_new_band_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.user_id = old.user_id and new.band_id = old.band_id then return new; end if;
  if not public.portal_account_is_active(new.user_id) then raise exception 'Member is archived'; end if;
  return new;
end;
$$;
drop trigger if exists portal_check_new_band_member on public.band_members;
create trigger portal_check_new_band_member before insert or update on public.band_members
for each row execute function public.portal_check_new_band_member();

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
commit;
