begin;

-- profile_leaders: multiple leader roles per profile
create table if not exists public.profile_leaders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  leader leader_role not null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_profile_leaders_profile_leader
  on public.profile_leaders(profile_id, leader);

alter table public.profile_leaders enable row level security;

drop policy if exists "profile_leaders_select_all_authenticated" on public.profile_leaders;
drop policy if exists "profile_leaders_write_admin" on public.profile_leaders;

create policy "profile_leaders_select_all_authenticated"
on public.profile_leaders
for select
to authenticated
using (true);

create policy "profile_leaders_write_admin"
on public.profile_leaders
for all
to authenticated
using (public.is_admin_or_supervisor(auth.uid()))
with check (public.is_admin_or_supervisor(auth.uid()));

-- Block Administrator role changes from client requests.
create or replace function public.block_admin_role_changes()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
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

drop trigger if exists trg_profile_leaders_block_admin on public.profile_leaders;
create trigger trg_profile_leaders_block_admin
before insert or update or delete
on public.profile_leaders
for each row execute function public.block_admin_role_changes();

-- Keep profiles.leader in sync with highest priority role.
create or replace function public.sync_profile_primary_leader()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  primary_leader leader_role;
begin
  if tg_op = 'DELETE' then
    target := old.profile_id;
  else
    target := new.profile_id;
  end if;

  select leader into primary_leader
  from public.profile_leaders
  where profile_id = target
  order by case leader
    when 'Administrator' then 1
    when 'Supervisor' then 2
    when 'PA Leader' then 3
    when 'Lighting Leader' then 4
    when 'Part Leader' then 5
    else 99
  end
  limit 1;

  update public.profiles
  set leader = coalesce(primary_leader, 'none'::leader_role)
  where id = target;

  return null;
end;
$$;

drop trigger if exists trg_profile_leaders_sync on public.profile_leaders;
create trigger trg_profile_leaders_sync
after insert or update or delete
on public.profile_leaders
for each row execute function public.sync_profile_primary_leader();

-- Update helper functions to read profile_leaders.
create or replace function public.is_admin_or_supervisor(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_leaders pl
    where pl.profile_id = uid
      and pl.leader in ('Administrator'::leader_role, 'Supervisor'::leader_role)
  );
$$;

create or replace function public.is_pa_leader(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_leaders pl
    where pl.profile_id = uid
      and pl.leader = 'PA Leader'::leader_role
  );
$$;

create or replace function public.is_lighting_leader(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_leaders pl
    where pl.profile_id = uid
      and pl.leader = 'Lighting Leader'::leader_role
  );
$$;

-- Migrate existing profiles.leader into profile_leaders.
insert into public.profile_leaders (profile_id, leader)
select id, leader
from public.profiles
where leader is not null and leader <> 'none'::leader_role
on conflict (profile_id, leader) do nothing;

commit;
