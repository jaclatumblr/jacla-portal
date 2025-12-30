begin;

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'other',
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedbacks_profile_id on public.feedbacks(profile_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'feedbacks_category_check') then
    alter table public.feedbacks
      add constraint feedbacks_category_check
      check (category in ('ui', 'bug', 'feature', 'other'));
  end if;
end $$;

alter table public.feedbacks enable row level security;

drop policy if exists "feedbacks_insert_authenticated" on public.feedbacks;
drop policy if exists "feedbacks_select_admin" on public.feedbacks;

create policy "feedbacks_insert_authenticated"
on public.feedbacks for insert
to authenticated
with check (profile_id = auth.uid());

create policy "feedbacks_select_admin"
on public.feedbacks for select
to authenticated
using (public.is_admin_or_supervisor(auth.uid()));

commit;
