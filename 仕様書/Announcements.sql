begin;

-- =========================================================
-- Jacla Portal: announcements (お知らせ)
-- =========================================================

-- updated_at 付与用
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- カテゴリ (固定候補)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'announcement_category') then
    create type announcement_category as enum (
      '重要',
      'イベント',
      '締切',
      '機材',
      '事務',
      'お知らせ'
    );
  end if;
end $$;

-- announcements 本体
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category announcement_category not null default 'お知らせ',
  is_published boolean not null default false,
  published_at timestamptz,
  is_pinned boolean not null default false,
  image_url text,
  attachment_url text,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_announcements_published_at
  on public.announcements(published_at desc nulls last);
create index if not exists idx_announcements_created_at
  on public.announcements(created_at desc);
create index if not exists idx_announcements_is_published
  on public.announcements(is_published);

create or replace function public.announcements_set_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.is_published then
    if new.published_at is null then
      new.published_at := now();
    end if;
  else
    new.published_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_announcements_published_at on public.announcements;
create trigger trg_announcements_published_at
before insert or update on public.announcements
for each row execute function public.announcements_set_published_at();

drop trigger if exists trg_announcements_updated_at on public.announcements;
create trigger trg_announcements_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

-- =========================================================
-- RLS
-- =========================================================
alter table public.announcements enable row level security;

drop policy if exists "announcements_select_published_or_privileged" on public.announcements;
drop policy if exists "announcements_manage_privileged" on public.announcements;

create policy "announcements_select_published_or_privileged"
on public.announcements
for select
to authenticated
using (
  is_published = true
  or public.is_admin_or_supervisor(auth.uid())
  or public.is_pa_leader(auth.uid())
  or public.is_lighting_leader(auth.uid())
);

create policy "announcements_manage_privileged"
on public.announcements
for all
to authenticated
using (
  public.is_admin_or_supervisor(auth.uid())
  or public.is_pa_leader(auth.uid())
  or public.is_lighting_leader(auth.uid())
)
with check (
  public.is_admin_or_supervisor(auth.uid())
  or public.is_pa_leader(auth.uid())
  or public.is_lighting_leader(auth.uid())
);

-- =========================================================
-- Storage buckets (avatars / announcement images)
-- =========================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('announcement-images', 'announcement-images', true)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

drop policy if exists "storage_read_public_avatars_and_announcements" on storage.objects;
create policy "storage_read_public_avatars_and_announcements"
on storage.objects
for select
using (bucket_id in ('avatars', 'announcement-images'));

drop policy if exists "storage_avatar_insert_own" on storage.objects;
create policy "storage_avatar_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "storage_avatar_update_own" on storage.objects;
create policy "storage_avatar_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = split_part(name, '/', 1)
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "storage_avatar_delete_own" on storage.objects;
create policy "storage_avatar_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "storage_announcement_images_manage" on storage.objects;
create policy "storage_announcement_images_manage"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'announcement-images'
  and (
    public.is_admin_or_supervisor(auth.uid())
    or public.is_pa_leader(auth.uid())
    or public.is_lighting_leader(auth.uid())
  )
)
with check (
  bucket_id = 'announcement-images'
  and (
    public.is_admin_or_supervisor(auth.uid())
    or public.is_pa_leader(auth.uid())
    or public.is_lighting_leader(auth.uid())
  )
);

commit;
