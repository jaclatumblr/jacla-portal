begin;

-- profile_parts: main/sub parts per profile
create table if not exists public.profile_parts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  part part_role not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_profile_parts_profile_part
  on public.profile_parts(profile_id, part);

create unique index if not exists uq_profile_parts_primary
  on public.profile_parts(profile_id)
  where is_primary;

alter table public.profile_parts enable row level security;

drop policy if exists "profile_parts_select_all_authenticated" on public.profile_parts;
drop policy if exists "profile_parts_write_owner_or_admin" on public.profile_parts;

create policy "profile_parts_select_all_authenticated"
on public.profile_parts for select
to authenticated
using (true);

create policy "profile_parts_write_owner_or_admin"
on public.profile_parts for all
to authenticated
using (
  profile_id = auth.uid()
  or public.is_admin_or_supervisor(auth.uid())
)
with check (
  profile_id = auth.uid()
  or public.is_admin_or_supervisor(auth.uid())
);

-- keep profiles.part in sync with primary part
create or replace function public.sync_profile_primary_part()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  primary_part part_role;
begin
  if tg_op = 'DELETE' then
    target := old.profile_id;
  else
    target := new.profile_id;
  end if;

  select part into primary_part
  from public.profile_parts
  where profile_id = target and is_primary = true
  order by created_at asc
  limit 1;

  update public.profiles
  set part = coalesce(primary_part, 'none'::part_role)
  where id = target;

  return null;
end;
$$;

drop trigger if exists trg_profile_parts_sync on public.profile_parts;
create trigger trg_profile_parts_sync
after insert or update or delete
on public.profile_parts
for each row execute function public.sync_profile_primary_part();

-- migrate existing primary part
insert into public.profile_parts (profile_id, part, is_primary)
select id, part, true
from public.profiles
where part is not null and part <> 'none'::part_role
on conflict (profile_id, part)
do update set is_primary = excluded.is_primary;

commit;
