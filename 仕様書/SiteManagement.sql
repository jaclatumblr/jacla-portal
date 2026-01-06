begin;

-- Site open/close settings
create table if not exists public.site_settings (
  id smallint primary key default 1,
  is_open boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.site_settings (id, is_open)
values (1, true)
on conflict (id) do nothing;

-- Login history
create table if not exists public.login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_history_user_id
  on public.login_history(user_id, created_at desc);

-- Page views / event access
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  path text not null,
  event_id uuid references public.events(id) on delete set null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_page_views_event
  on public.page_views(event_id, created_at desc);

create index if not exists idx_page_views_user
  on public.page_views(user_id, created_at desc);

-- Update logs (release notes)
create table if not exists public.update_logs (
  id uuid primary key default gen_random_uuid(),
  version text,
  title text not null,
  summary text not null,
  details text,
  is_version_bump boolean not null default false,
  is_published boolean not null default true,
  commit_sha text,
  commit_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_update_logs_created_at
  on public.update_logs(created_at desc);

alter table public.update_logs
  add column if not exists version text,
  add column if not exists is_version_bump boolean not null default false,
  add column if not exists commit_sha text,
  add column if not exists commit_url text;

create unique index if not exists uq_update_logs_commit_sha
  on public.update_logs(commit_sha);

create or replace function public.is_administrator(uid uuid)
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
      and pl.leader = 'Administrator'
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.leader = 'Administrator'::leader_role
  );
$$;

create or replace function public.is_web_secretary(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_positions pp
    where pp.profile_id = uid
      and pp.position = 'Web Secretary'::position_role
  );
$$;

drop trigger if exists trg_update_logs_set_updated_at on public.update_logs;
create trigger trg_update_logs_set_updated_at
before update on public.update_logs
for each row execute function public.set_updated_at();

-- RLS
alter table public.site_settings enable row level security;
alter table public.login_history enable row level security;
alter table public.page_views enable row level security;
alter table public.update_logs enable row level security;

drop policy if exists "site_settings_select_all" on public.site_settings;
drop policy if exists "site_settings_write_admin" on public.site_settings;
drop policy if exists "site_settings_insert_admin" on public.site_settings;

create policy "site_settings_select_all"
on public.site_settings
for select
to authenticated
using (true);

create policy "site_settings_write_admin"
on public.site_settings
for update
to authenticated
using (public.is_admin_or_supervisor(auth.uid()))
with check (public.is_admin_or_supervisor(auth.uid()));

create policy "site_settings_insert_admin"
on public.site_settings
for insert
to authenticated
with check (public.is_admin_or_supervisor(auth.uid()));

drop policy if exists "login_history_insert_self" on public.login_history;
drop policy if exists "login_history_select_admin" on public.login_history;

create policy "login_history_insert_self"
on public.login_history
for insert
to authenticated
with check (user_id = auth.uid());

create policy "login_history_select_admin"
on public.login_history
for select
to authenticated
using (public.is_admin_or_supervisor(auth.uid()));

drop policy if exists "page_views_insert_self" on public.page_views;
drop policy if exists "page_views_select_admin" on public.page_views;

create policy "page_views_insert_self"
on public.page_views
for insert
to authenticated
with check (user_id = auth.uid());

create policy "page_views_select_admin"
on public.page_views
for select
to authenticated
using (public.is_admin_or_supervisor(auth.uid()));

drop policy if exists "update_logs_select_published" on public.update_logs;
drop policy if exists "update_logs_write_admin" on public.update_logs;

create policy "update_logs_select_published"
on public.update_logs
for select
to authenticated
using (
  is_published = true
  or public.is_administrator(auth.uid())
  or public.is_web_secretary(auth.uid())
);

create policy "update_logs_write_admin"
on public.update_logs
for all
to authenticated
using (
  public.is_administrator(auth.uid())
  or public.is_web_secretary(auth.uid())
)
with check (
  public.is_administrator(auth.uid())
  or public.is_web_secretary(auth.uid())
);

commit;
