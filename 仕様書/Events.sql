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

-- =========================
-- 1) events
-- =========================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null,
  status text not null default 'draft',  -- draft / recruiting / fixed / closed
  venue text,
  open_time time,
  start_time time,
  note text,

  default_song_duration_sec int4 not null default 240,   -- 4分
  default_changeover_min    int4 not null default 15,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  add column if not exists note_lighting text;

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
);

-- 更新/削除：作成者 or Admin/Supervisor
create policy "bands_update_owner_or_admin"
on public.bands for update
to authenticated
using (
  created_by = auth.uid()
  or public.is_admin_or_supervisor(auth.uid())
)
with check (
  created_by = auth.uid()
  or public.is_admin_or_supervisor(auth.uid())
);

create policy "bands_delete_owner_or_admin"
on public.bands for delete
to authenticated
using (
  created_by = auth.uid()
  or public.is_admin_or_supervisor(auth.uid())
);


-- =========================
-- 3) band_members（バンド構成）
-- =========================
create table if not exists public.band_members (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  instrument text not null,          -- このバンドでの担当（例: "Sax", "Key"）
  created_at timestamptz not null default now()
);

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
      and (b.created_by = auth.uid() or public.is_admin_or_supervisor(auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.bands b
    where b.id = band_id
      and (b.created_by = auth.uid() or public.is_admin_or_supervisor(auth.uid()))
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
  duration_sec int4,                -- 任意。空ならevents.default_song_duration_sec使う想定
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists idx_songs_band_id on public.songs(band_id);

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
      and (b.created_by = auth.uid() or public.is_admin_or_supervisor(auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.bands b
    where b.id = band_id
      and (b.created_by = auth.uid() or public.is_admin_or_supervisor(auth.uid()))
  )
);

commit;
