-- =========================================================
-- Jacla Portal: 汎用フォーム（フォーム管理 / 回答）
-- =========================================================
-- 目的：
--  1) フォーム定義（タイトル/説明/公開フラグ）
--  2) フィールド定義（種類/必須/選択肢/並び順）
--  3) 回答の保存
--  4) 管理者のみ編集、公開されたフォームは提出可能
-- =========================================================

begin;

-- =========================================================
-- 1) forms
-- =========================================================
create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  is_published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_forms_created_by on public.forms(created_by);

drop trigger if exists trg_forms_updated_at on public.forms;
create trigger trg_forms_updated_at
before update on public.forms
for each row execute function public.set_updated_at();

alter table public.forms enable row level security;

drop policy if exists "forms_select_published_or_admin" on public.forms;
drop policy if exists "forms_write_admin" on public.forms;

create policy "forms_select_published_or_admin"
on public.forms
for select
to authenticated
using (
  is_published
  or public.is_admin_or_supervisor(auth.uid())
);

create policy "forms_write_admin"
on public.forms
for all
to authenticated
using (public.is_admin_or_supervisor(auth.uid()))
with check (public.is_admin_or_supervisor(auth.uid()));

-- =========================================================
-- 2) form_fields
-- =========================================================
create table if not exists public.form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  label text not null,
  field_type text not null,
  is_required boolean not null default false,
  options text[] not null default '{}'::text[],
  placeholder text,
  order_index int4 not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_form_fields_form_id on public.form_fields(form_id);

drop trigger if exists trg_form_fields_updated_at on public.form_fields;
create trigger trg_form_fields_updated_at
before update on public.form_fields
for each row execute function public.set_updated_at();

alter table public.form_fields enable row level security;

drop policy if exists "form_fields_select_published_or_admin" on public.form_fields;
drop policy if exists "form_fields_write_admin" on public.form_fields;

create policy "form_fields_select_published_or_admin"
on public.form_fields
for select
to authenticated
using (
  exists (
    select 1
    from public.forms f
    where f.id = form_id
      and (
        f.is_published
        or public.is_admin_or_supervisor(auth.uid())
      )
  )
);

create policy "form_fields_write_admin"
on public.form_fields
for all
to authenticated
using (public.is_admin_or_supervisor(auth.uid()))
with check (public.is_admin_or_supervisor(auth.uid()));

-- =========================================================
-- 3) form_responses
-- =========================================================
create table if not exists public.form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_form_responses_form_id on public.form_responses(form_id);
create index if not exists idx_form_responses_submitted_by on public.form_responses(submitted_by);

alter table public.form_responses enable row level security;

drop policy if exists "form_responses_select_owner_or_admin" on public.form_responses;
drop policy if exists "form_responses_insert_published_or_admin" on public.form_responses;

create policy "form_responses_select_owner_or_admin"
on public.form_responses
for select
to authenticated
using (
  submitted_by = auth.uid()
  or public.is_admin_or_supervisor(auth.uid())
);

create policy "form_responses_insert_published_or_admin"
on public.form_responses
for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and exists (
    select 1
    from public.forms f
    where f.id = form_id
      and (
        f.is_published
        or public.is_admin_or_supervisor(auth.uid())
      )
  )
);

-- =========================================================
-- 4) form_response_answers
-- =========================================================
create table if not exists public.form_response_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.form_responses(id) on delete cascade,
  field_id uuid not null references public.form_fields(id) on delete cascade,
  value text,
  created_at timestamptz not null default now()
);

create index if not exists idx_form_response_answers_response_id on public.form_response_answers(response_id);
create index if not exists idx_form_response_answers_field_id on public.form_response_answers(field_id);

alter table public.form_response_answers enable row level security;

drop policy if exists "form_response_answers_select_owner_or_admin" on public.form_response_answers;
drop policy if exists "form_response_answers_insert_owner_or_admin" on public.form_response_answers;

create policy "form_response_answers_select_owner_or_admin"
on public.form_response_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.form_responses r
    where r.id = response_id
      and (
        r.submitted_by = auth.uid()
        or public.is_admin_or_supervisor(auth.uid())
      )
  )
);

create policy "form_response_answers_insert_owner_or_admin"
on public.form_response_answers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.form_responses r
    where r.id = response_id
      and (
        r.submitted_by = auth.uid()
        or public.is_admin_or_supervisor(auth.uid())
      )
  )
);

commit;
