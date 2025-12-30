begin;

-- =========================
-- 0) updated_at 自動更新トリガ（汎用）
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_band_member(band uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.band_members bm
    where bm.band_id = band
      and bm.user_id = uid
  )
  or exists (
    select 1
    from public.bands b
    where b.id = band
      and b.created_by = uid
  );
$$;

-- =========================
-- 1) events
-- =========================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null,
  status text not null default 'draft',  -- draft / recruiting / fixed / closed
  event_type text not null default 'live',
  venue text,
  open_time time,
  start_time time,
  note text,

  default_changeover_min    int4 not null default 15,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events
  drop column if exists default_song_duration_sec;

alter table public.events
  add column if not exists event_type text not null default 'live';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_event_type_check'
  ) then
    alter table public.events
      add constraint events_event_type_check
      check (event_type in ('live', 'workshop', 'briefing', 'camp', 'other'));
  end if;
end $$;

update public.events
set event_type = 'live'
where event_type is null;

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

alter table public.events enable row level security;

drop policy if exists "events_select_all_authenticated" on public.events;
drop policy if exists "events_insert_admin" on public.events;
drop policy if exists "events_update_admin" on public.events;
drop policy if exists "events_delete_admin" on public.events;

create policy "events_select_all_authenticated"
on public.events for select
to authenticated
using (true);

create policy "events_insert_admin"
on public.events for insert
to authenticated
with check (public.is_admin_or_supervisor(auth.uid()));

create policy "events_update_admin"
on public.events for update
to authenticated
using (public.is_admin_or_supervisor(auth.uid()))
with check (public.is_admin_or_supervisor(auth.uid()));

create policy "events_delete_admin"
on public.events for delete
to authenticated
using (public.is_admin_or_supervisor(auth.uid()));


-- =========================
-- 2) bands（イベント内のバンド）
-- =========================
create table if not exists public.bands (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,

  stage_plot_data jsonb not null default '{}'::jsonb,
  representative_name text,
  sound_note text,
  lighting_note text,
  general_note text,
  lighting_total_min int4,
  is_approved boolean not null default false,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bands_event_id on public.bands(event_id);

drop trigger if exists trg_bands_updated_at on public.bands;
create trigger trg_bands_updated_at
before update on public.bands
for each row execute function public.set_updated_at();

alter table public.bands enable row level security;

drop policy if exists "bands_select_all_authenticated" on public.bands;
drop policy if exists "bands_insert_authenticated" on public.bands;
drop policy if exists "bands_update_owner_or_admin" on public.bands;
drop policy if exists "bands_delete_owner_or_admin" on public.bands;

alter table public.bands
  add column if not exists note_pa text,
  add column if not exists note_lighting text,
  add column if not exists repertoire_status text not null default 'draft',
  add column if not exists representative_name text,
  add column if not exists sound_note text,
  add column if not exists lighting_note text,
  add column if not exists general_note text,
  add column if not exists lighting_total_min int4;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bands_repertoire_status_check'
  ) then
    alter table public.bands
      add constraint bands_repertoire_status_check
      check (repertoire_status in ('draft', 'submitted'));
  end if;
end $$;

create policy "bands_select_all_authenticated"
on public.bands for select
to authenticated
using (true);

-- バンド作成は誰でもOK（ログイン必須）
create policy "bands_insert_authenticated"
on public.bands for insert
to authenticated
with check (
  created_by = auth.uid()  -- ここを必須にして「作成者固定」
  and exists (
    select 1 from public.events e
    where e.id = event_id
      and e.event_type in ('live', 'camp')
  )
);

-- 更新/削除：作成者 or Admin/Supervisor
create policy "bands_update_owner_or_admin"
on public.bands for update
to authenticated
using (
  created_by = auth.uid()
  or public.is_admin_or_supervisor(auth.uid())
  or public.is_band_member(id, auth.uid())
  or exists (
    select 1 from public.profile_leaders pl
    where pl.profile_id = auth.uid()
      and pl.leader in ('Part Leader', 'PA Leader', 'Lighting Leader')
  )
)
with check (
  created_by = auth.uid()
  or public.is_admin_or_supervisor(auth.uid())
  or public.is_band_member(id, auth.uid())
  or exists (
    select 1 from public.profile_leaders pl
    where pl.profile_id = auth.uid()
      and pl.leader in ('Part Leader', 'PA Leader', 'Lighting Leader')
  )
);

create policy "bands_delete_owner_or_admin"
on public.bands for delete
to authenticated
using (
  created_by = auth.uid()
  or public.is_admin_or_supervisor(auth.uid())
  or exists (
    select 1 from public.profile_leaders pl
    where pl.profile_id = auth.uid()
      and pl.leader in ('PA Leader', 'Lighting Leader')
  )
);

create or replace function public.bands_block_member_update()
returns trigger
language plpgsql
as $$
declare
  actor uuid;
  actor_is_admin boolean;
  actor_is_owner boolean;
  actor_is_member boolean;
  actor_is_leader boolean;
begin
  actor := auth.uid();

  if actor is null then
    return new;
  end if;

  actor_is_admin := public.is_admin_or_supervisor(actor);
  if actor_is_admin then
    return new;
  end if;

  actor_is_leader := exists (
    select 1 from public.profile_leaders pl
    where pl.profile_id = actor
      and pl.leader in ('Part Leader', 'PA Leader', 'Lighting Leader')
  );

  actor_is_owner := old.created_by = actor;
  if actor_is_owner then
    return new;
  end if;

  actor_is_member := public.is_band_member(old.id, actor);
  if actor_is_member or actor_is_leader then
    if (
      to_jsonb(new)
      - 'repertoire_status'
      - 'stage_plot_data'
      - 'representative_name'
      - 'sound_note'
      - 'lighting_note'
      - 'general_note'
      - 'lighting_total_min'
      - 'updated_at'
    ) <> (
      to_jsonb(old)
      - 'repertoire_status'
      - 'stage_plot_data'
      - 'representative_name'
      - 'sound_note'
      - 'lighting_note'
      - 'general_note'
      - 'lighting_total_min'
      - 'updated_at'
    ) then
      raise exception 'Band members/leaders can only update repertoire and notes fields.';
    end if;
    return new;
  end if;

  raise exception 'Not allowed to update band.';
end;
$$;

drop trigger if exists trg_bands_block_member_update on public.bands;
create trigger trg_bands_block_member_update
before update on public.bands
for each row execute function public.bands_block_member_update();


-- =========================
-- 3) band_members（バンド構成）
-- =========================
create table if not exists public.band_members (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  instrument text not null,          -- このバンドでの担当（例: "Sax", "Key"）
  position_x numeric,                -- 立ち位置 X(0-100)
  position_y numeric,                -- 立ち位置 Y(0-100)
  monitor_request text,
  monitor_note text,
  is_mc boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.band_members
  add column if not exists position_x numeric,
  add column if not exists position_y numeric,
  add column if not exists monitor_request text,
  add column if not exists monitor_note text,
  add column if not exists is_mc boolean not null default false;

create index if not exists idx_band_members_band_id on public.band_members(band_id);
create index if not exists idx_band_members_user_id on public.band_members(user_id);

-- 同一バンドに同じ人+同じ担当を重複登録しない（必要なら）
create unique index if not exists uq_band_members_band_user_inst
on public.band_members(band_id, user_id, instrument);

alter table public.band_members enable row level security;

drop policy if exists "band_members_select_all_authenticated" on public.band_members;
drop policy if exists "band_members_write_band_owner_or_admin" on public.band_members;

create policy "band_members_select_all_authenticated"
on public.band_members for select
to authenticated
using (true);

-- 追加/更新/削除：その band の作成者 or Admin/Supervisor
create policy "band_members_write_band_owner_or_admin"
on public.band_members for all
to authenticated
using (
  exists (
    select 1 from public.bands b
    where b.id = band_id
      and (
        b.created_by = auth.uid()
        or public.is_admin_or_supervisor(auth.uid())
        or public.is_band_member(b.id, auth.uid())
        or exists (
          select 1 from public.profile_leaders pl
          where pl.profile_id = auth.uid()
            and pl.leader in ('Part Leader', 'PA Leader', 'Lighting Leader')
        )
      )
  )
  or user_id = auth.uid()
)
with check (
  exists (
    select 1 from public.bands b
    where b.id = band_id
      and (
        b.created_by = auth.uid()
        or public.is_admin_or_supervisor(auth.uid())
        or public.is_band_member(b.id, auth.uid())
        or exists (
          select 1 from public.profile_leaders pl
          where pl.profile_id = auth.uid()
            and pl.leader in ('Part Leader', 'PA Leader', 'Lighting Leader')
        )
      )
  )
  or user_id = auth.uid()
  and exists (
    select 1
    from public.bands b
    join public.events e on e.id = b.event_id
    where b.id = band_id
      and e.event_type in ('live', 'camp')
  )
);


-- =========================
-- 4) songs（セットリスト）
-- =========================
create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  title text not null,
  artist text,
  entry_type text not null default 'song',
  url text,
  order_index int4,
  duration_sec int4,                -- 任意
  arrangement_note text,
  lighting_spot text,
  lighting_strobe text,
  lighting_moving text,
  lighting_color text,
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists idx_songs_band_id on public.songs(band_id);

alter table public.songs
  add column if not exists entry_type text not null default 'song',
  add column if not exists url text,
  add column if not exists order_index int4,
  add column if not exists arrangement_note text,
  add column if not exists lighting_spot text,
  add column if not exists lighting_strobe text,
  add column if not exists lighting_moving text,
  add column if not exists lighting_color text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'songs_lighting_spot_check') then
    alter table public.songs
      add constraint songs_lighting_spot_check
      check (lighting_spot is null or lighting_spot in ('o', 'x', 'auto'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'songs_lighting_strobe_check') then
    alter table public.songs
      add constraint songs_lighting_strobe_check
      check (lighting_strobe is null or lighting_strobe in ('o', 'x', 'auto'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'songs_lighting_moving_check') then
    alter table public.songs
      add constraint songs_lighting_moving_check
      check (lighting_moving is null or lighting_moving in ('o', 'x', 'auto'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'songs_entry_type_check'
  ) then
    alter table public.songs
      add constraint songs_entry_type_check
      check (entry_type in ('song', 'mc'));
  end if;
end $$;

do $$
begin
  if exists (select 1 from public.songs) then
    update public.songs s
    set order_index = ranked.rn
    from (
      select id, row_number() over (partition by band_id order by created_at) as rn
      from public.songs
      where order_index is null
    ) ranked
    where s.id = ranked.id;
  end if;
end $$;

alter table public.songs enable row level security;

drop policy if exists "songs_select_all_authenticated" on public.songs;
drop policy if exists "songs_write_band_owner_or_admin" on public.songs;

create policy "songs_select_all_authenticated"
on public.songs for select
to authenticated
using (true);

create policy "songs_write_band_owner_or_admin"
on public.songs for all
to authenticated
using (
  exists (
    select 1 from public.bands b
    where b.id = band_id
      and (
        b.created_by = auth.uid()
        or public.is_admin_or_supervisor(auth.uid())
        or public.is_band_member(b.id, auth.uid())
        or exists (
          select 1 from public.profile_leaders pl
          where pl.profile_id = auth.uid()
            and pl.leader in ('Part Leader', 'PA Leader', 'Lighting Leader')
        )
      )
  )
)
with check (
  exists (
    select 1 from public.bands b
    where b.id = band_id
      and (
        b.created_by = auth.uid()
        or public.is_admin_or_supervisor(auth.uid())
        or public.is_band_member(b.id, auth.uid())
        or exists (
          select 1 from public.profile_leaders pl
          where pl.profile_id = auth.uid()
            and pl.leader in ('Part Leader', 'PA Leader', 'Lighting Leader')
        )
      )
  )
);

-- =========================
-- 5) event_slots（TT/スロット）
-- =========================
create table if not exists public.event_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  band_id uuid references public.bands(id) on delete set null,
  slot_type text not null default 'band', -- band / break / mc / other
  order_in_event int4,
  start_time time,
  end_time time,
  changeover_min int4,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_slots_event_id on public.event_slots(event_id);
create index if not exists idx_event_slots_band_id on public.event_slots(band_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'event_slots_type_check') then
    alter table public.event_slots
      add constraint event_slots_type_check
      check (slot_type in ('band', 'break', 'mc', 'other'));
  end if;
end $$;

drop trigger if exists trg_event_slots_updated_at on public.event_slots;
create trigger trg_event_slots_updated_at
before update on public.event_slots
for each row execute function public.set_updated_at();

alter table public.event_slots enable row level security;

drop policy if exists "event_slots_select_all_authenticated" on public.event_slots;
drop policy if exists "event_slots_write_admin" on public.event_slots;

create policy "event_slots_select_all_authenticated"
on public.event_slots for select
to authenticated
using (true);

create policy "event_slots_write_admin"
on public.event_slots for all
to authenticated
using (public.is_admin_or_supervisor(auth.uid()))
with check (public.is_admin_or_supervisor(auth.uid()));

-- =========================
-- 6) event_staff_members（イベント参加クルー）
-- =========================
create table if not exists public.event_staff_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  can_pa boolean not null default false,
  can_light boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_event_staff_event_profile
  on public.event_staff_members(event_id, profile_id);

alter table public.event_staff_members enable row level security;

drop policy if exists "event_staff_members_select_all_authenticated" on public.event_staff_members;
drop policy if exists "event_staff_members_write_admin" on public.event_staff_members;

create policy "event_staff_members_select_all_authenticated"
on public.event_staff_members for select
to authenticated
using (true);

create policy "event_staff_members_write_admin"
on public.event_staff_members for all
to authenticated
using (public.is_admin_or_supervisor(auth.uid()))
with check (public.is_admin_or_supervisor(auth.uid()));

-- =========================
-- 7) slot_staff_assignments（スロット担当）
-- =========================
create table if not exists public.slot_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  event_slot_id uuid not null references public.event_slots(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null, -- pa / light
  is_fixed boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_slot_staff_slot_id on public.slot_staff_assignments(event_slot_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'slot_staff_role_check') then
    alter table public.slot_staff_assignments
      add constraint slot_staff_role_check
      check (role in ('pa', 'light'));
  end if;
end $$;

alter table public.slot_staff_assignments enable row level security;

drop policy if exists "slot_staff_assignments_select_all_authenticated" on public.slot_staff_assignments;
drop policy if exists "slot_staff_assignments_write_admin" on public.slot_staff_assignments;

create policy "slot_staff_assignments_select_all_authenticated"
on public.slot_staff_assignments for select
to authenticated
using (true);

create policy "slot_staff_assignments_write_admin"
on public.slot_staff_assignments for all
to authenticated
using (public.is_admin_or_supervisor(auth.uid()))
with check (public.is_admin_or_supervisor(auth.uid()));

commit;
