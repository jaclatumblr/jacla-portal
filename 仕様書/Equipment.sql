begin;

-- =========================================================
-- Jacla Portal: equipment management (equipment/instruments)
-- =========================================================

-- ---- helper roles ----
create or replace function public.is_part_leader(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.leader = 'Part Leader'::leader_role
  )
  or exists (
    select 1
    from public.profile_leaders pl
    where pl.profile_id = uid
      and pl.leader = 'Part Leader'
  );
$$;

-- ---- enums ----
do $$
begin
  if not exists (select 1 from pg_type where typname = 'equipment_scope') then
    create type equipment_scope as enum ('equipment', 'instruments');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'equipment_status') then
    create type equipment_status as enum (
      'ok',
      'needs_repair',
      'needs_replace',
      'missing',
      'loaned'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'equipment_category') then
    create type equipment_category as enum ('PA', 'Lighting', 'General');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'equipment_instrument_section') then
    create type equipment_instrument_section as enum (
      'ギター',
      'ベース',
      'ドラム',
      'キーボード',
      '管楽器',
      'その他'
    );
  end if;
end $$;

-- ---- settings ----
create table if not exists public.equipment_settings (
  scope equipment_scope primary key,
  open_to_all boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.equipment_settings (scope)
values ('equipment'), ('instruments')
on conflict (scope) do nothing;

create or replace function public.can_edit_equipment(target_scope equipment_scope)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_or_supervisor(auth.uid())
    or public.is_pa_leader(auth.uid())
    or public.is_lighting_leader(auth.uid())
    or public.is_part_leader(auth.uid())
    or coalesce(
      (
        select s.open_to_all
        from public.equipment_settings s
        where s.scope = target_scope
      ),
      false
    );
$$;

create or replace function public.equipment_settings_set_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_equipment_settings_updated on public.equipment_settings;
create trigger trg_equipment_settings_updated
before update on public.equipment_settings
for each row execute function public.equipment_settings_set_updated();

-- ---- equipment items ----
create table if not exists public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category equipment_category not null default 'General',
  manufacturer text,
  model text,
  location text,
  quantity integer not null default 1,
  status equipment_status not null default 'ok',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_equipment_items_category
  on public.equipment_items(category);
create index if not exists idx_equipment_items_status
  on public.equipment_items(status);
create index if not exists idx_equipment_items_updated_at
  on public.equipment_items(updated_at desc);

-- ---- instruments ----
create table if not exists public.equipment_instruments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  section equipment_instrument_section not null default 'その他',
  manufacturer text,
  model text,
  location text,
  quantity integer not null default 1,
  status equipment_status not null default 'ok',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_equipment_instruments_section
  on public.equipment_instruments(section);
create index if not exists idx_equipment_instruments_status
  on public.equipment_instruments(status);
create index if not exists idx_equipment_instruments_updated_at
  on public.equipment_instruments(updated_at desc);

-- ---- audit/update triggers ----
create or replace function public.equipment_set_audit()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.created_by is null then
      new.created_by := auth.uid();
    end if;
  end if;

  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_equipment_items_audit on public.equipment_items;
create trigger trg_equipment_items_audit
before insert or update on public.equipment_items
for each row execute function public.equipment_set_audit();

drop trigger if exists trg_equipment_instruments_audit on public.equipment_instruments;
create trigger trg_equipment_instruments_audit
before insert or update on public.equipment_instruments
for each row execute function public.equipment_set_audit();

-- ---- logs ----
create table if not exists public.equipment_item_logs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.equipment_items(id) on delete cascade,
  status equipment_status not null,
  note text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_equipment_item_logs_item
  on public.equipment_item_logs(item_id, created_at desc);

create table if not exists public.equipment_instrument_logs (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.equipment_instruments(id) on delete cascade,
  status equipment_status not null,
  note text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_equipment_instrument_logs_instrument
  on public.equipment_instrument_logs(instrument_id, created_at desc);

create or replace function public.log_equipment_item()
returns trigger
language plpgsql
as $$
declare
  actor uuid;
begin
  actor := auth.uid();
  if actor is null then
    actor := new.updated_by;
  end if;

  insert into public.equipment_item_logs (item_id, status, note, changed_by)
  values (new.id, new.status, new.notes, actor);

  return new;
end;
$$;

create or replace function public.log_equipment_instrument()
returns trigger
language plpgsql
as $$
declare
  actor uuid;
begin
  actor := auth.uid();
  if actor is null then
    actor := new.updated_by;
  end if;

  insert into public.equipment_instrument_logs (instrument_id, status, note, changed_by)
  values (new.id, new.status, new.notes, actor);

  return new;
end;
$$;

drop trigger if exists trg_equipment_items_log on public.equipment_items;
create trigger trg_equipment_items_log
after insert or update on public.equipment_items
for each row execute function public.log_equipment_item();

drop trigger if exists trg_equipment_instruments_log on public.equipment_instruments;
create trigger trg_equipment_instruments_log
after insert or update on public.equipment_instruments
for each row execute function public.log_equipment_instrument();

-- ---- RLS ----
alter table public.equipment_settings enable row level security;
alter table public.equipment_items enable row level security;
alter table public.equipment_instruments enable row level security;
alter table public.equipment_item_logs enable row level security;
alter table public.equipment_instrument_logs enable row level security;

drop policy if exists "equipment_settings_select_all" on public.equipment_settings;
drop policy if exists "equipment_settings_insert_admin" on public.equipment_settings;
drop policy if exists "equipment_settings_update_admin" on public.equipment_settings;

create policy "equipment_settings_select_all"
on public.equipment_settings
for select
to authenticated
using (true);

create policy "equipment_settings_insert_admin"
on public.equipment_settings
for insert
to authenticated
with check (public.is_admin_or_supervisor(auth.uid()));

create policy "equipment_settings_update_admin"
on public.equipment_settings
for update
to authenticated
using (public.is_admin_or_supervisor(auth.uid()))
with check (public.is_admin_or_supervisor(auth.uid()));

drop policy if exists "equipment_items_select_all" on public.equipment_items;
drop policy if exists "equipment_items_insert" on public.equipment_items;
drop policy if exists "equipment_items_update" on public.equipment_items;
drop policy if exists "equipment_items_delete" on public.equipment_items;

create policy "equipment_items_select_all"
on public.equipment_items
for select
to authenticated
using (true);

create policy "equipment_items_insert"
on public.equipment_items
for insert
to authenticated
with check (public.can_edit_equipment('equipment'));

create policy "equipment_items_update"
on public.equipment_items
for update
to authenticated
using (public.can_edit_equipment('equipment'))
with check (public.can_edit_equipment('equipment'));

create policy "equipment_items_delete"
on public.equipment_items
for delete
to authenticated
using (public.can_edit_equipment('equipment'));

drop policy if exists "equipment_instruments_select_all" on public.equipment_instruments;
drop policy if exists "equipment_instruments_insert" on public.equipment_instruments;
drop policy if exists "equipment_instruments_update" on public.equipment_instruments;
drop policy if exists "equipment_instruments_delete" on public.equipment_instruments;

create policy "equipment_instruments_select_all"
on public.equipment_instruments
for select
to authenticated
using (true);

create policy "equipment_instruments_insert"
on public.equipment_instruments
for insert
to authenticated
with check (public.can_edit_equipment('instruments'));

create policy "equipment_instruments_update"
on public.equipment_instruments
for update
to authenticated
using (public.can_edit_equipment('instruments'))
with check (public.can_edit_equipment('instruments'));

create policy "equipment_instruments_delete"
on public.equipment_instruments
for delete
to authenticated
using (public.can_edit_equipment('instruments'));

drop policy if exists "equipment_item_logs_select_all" on public.equipment_item_logs;
drop policy if exists "equipment_item_logs_insert" on public.equipment_item_logs;

create policy "equipment_item_logs_select_all"
on public.equipment_item_logs
for select
to authenticated
using (true);

create policy "equipment_item_logs_insert"
on public.equipment_item_logs
for insert
to authenticated
with check (public.can_edit_equipment('equipment'));

drop policy if exists "equipment_instrument_logs_select_all" on public.equipment_instrument_logs;
drop policy if exists "equipment_instrument_logs_insert" on public.equipment_instrument_logs;

create policy "equipment_instrument_logs_select_all"
on public.equipment_instrument_logs
for select
to authenticated
using (true);

create policy "equipment_instrument_logs_insert"
on public.equipment_instrument_logs
for insert
to authenticated
with check (public.can_edit_equipment('instruments'));

commit;
