-- =========================================================
-- Jacla Portal: profiles ロール設計
-- =========================================================
-- 目的：
--  1) 役職(leader) / 班(crew) / パート(part) / ミュート(muted) を profiles に持たせる
--  2) Supabase Table Editor で GUI 操作しやすいように ENUM を使う
--  3) RLS + Trigger で「権限の自己昇格」を防ぐ
--  4) PA長/照明長は crew（Pa/Lighting）だけ変更できるようにする
--
-- 重要：
--  - ENUM の値は “大小文字・空白・記号まで完全一致” が必要
--  - 既に同名ENUMを別定義で作っている場合は、手動で揃える必要がある
-- =========================================================

begin;

-- =========================================================
-- 0. 既存のポリシー/トリガーを一旦外す（型変更の邪魔になるため）
-- =========================================================
drop trigger if exists trg_profiles_block_privilege_escalation on public.profiles;

drop function if exists public.profiles_block_privilege_escalation();
-- NOTE: Do not drop helper functions referenced by policies on other tables.
-- Use CREATE OR REPLACE later in this script.

drop policy if exists "profiles_select_all_authenticated" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
drop policy if exists "profiles_pa_leader_update_crew" on public.profiles;
drop policy if exists "profiles_lighting_leader_update_crew" on public.profiles;


-- =========================================================
-- 1. ENUM 型定義（ズレてたら退避して作り直す）
-- =========================================================
do $$
declare
  leader_expected text[] := array[
    'none','Administrator','Supervisor','PA Leader','Lighting Leader','Part Leader'
  ];
  crew_expected   text[] := array[
    'User','PA','Lighting'
  ];
  part_expected   text[] := array[
    'none',
    'Gt.',
    'Ba.',
    'Dr.',
    'Key.',
    'Syn.',
    'Acc.',
    'W.Syn.',
    'S.Sax.',
    'A.Sax.',
    'T.Sax.',
    'B.Sax.',
    'Tp.',
    'Tb.',
    'Tu.',
    'Hr.',
    'Eup.',
    'Cl.',
    'B.Cl.',
    'Ob.',
    'Fg.'
    'Fl.',
    'Vn.',
    'Vc.',
    'Per.',
    'Ukl.',
    'Mand.',
    'etc'
  ];

  found int;
  found_old int;
begin
  -- ---- leader_role ----
  if exists (select 1 from pg_type where typname = 'leader_role') then
    select count(*) into found
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'leader_role'
      and e.enumlabel = any(leader_expected);

    if found <> array_length(leader_expected, 1) then
      begin
        execute 'drop type if exists leader_role_old';
      exception when others then
        null;
      end;

      execute 'alter type leader_role rename to leader_role_old';
    end if;
  end if;

  if not exists (select 1 from pg_type where typname = 'leader_role') then
    execute $e$
      create type leader_role as enum (
        'none',
        'Administrator',
        'Supervisor',
        'PA Leader',
        'Lighting Leader',
        'Part Leader'
      );
    $e$;
  end if;

  -- ---- crew_role ----
  if exists (select 1 from pg_type where typname = 'crew_role') then
    select count(*) into found
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'crew_role'
      and e.enumlabel = any(crew_expected);

    if found <> array_length(crew_expected, 1) then
      begin
        execute 'drop type if exists crew_role_old';
      exception when others then
        null;
      end;

      execute 'alter type crew_role rename to crew_role_old';
    end if;
  end if;

  if not exists (select 1 from pg_type where typname = 'crew_role') then
    execute $e$
      create type crew_role as enum (
        'User',
        'PA',
        'Lighting'
      );
    $e$;
  end if;

  -- ---- part_role ----
  if exists (select 1 from pg_type where typname = 'part_role') then
    select count(*) into found
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'part_role'
      and e.enumlabel = any(part_expected);

    if found <> array_length(part_expected, 1) then
      if exists (select 1 from pg_type where typname = 'part_role_old') then
        select count(*) into found_old
        from pg_attribute a
        join pg_type t on t.oid = a.atttypid
        where t.typname = 'part_role_old'
          and a.attnum > 0
          and not a.attisdropped;

        if found_old = 0 then
          execute 'drop type if exists part_role_old';
        else
          raise notice 'part_role_old is still in use; skipping rename.';
        end if;
      end if;

      if not exists (select 1 from pg_type where typname = 'part_role_old') then
        execute 'alter type part_role rename to part_role_old';
      end if;
    end if;
  end if;

  if not exists (select 1 from pg_type where typname = 'part_role') then
    execute $e$
      create type part_role as enum (
        'none',
        'Gt.','A.Gt.','C.Gt.','Ba.','Dr.','Key.','Syn.','Acc.','W.Syn.',
        'S.Sax.','A.Sax.','T.Sax.','B.Sax.','Tp.','Tb.','Tu.','Hr.','Eup.','Cl.','B.Cl.',
        'Ob.','Fl.','Vn.','Va.','Vc.','Per.','etc'
      );
    $e$;
  end if;
end $$;

-- ---- position_role (役職) ----
do $$
begin
  if not exists (select 1 from pg_type where typname = 'position_role') then
    create type position_role as enum (
      'Official',
      'President',
      'Vice President',
      'Treasurer',
      'PA Chief',
      'Lighting Chief',
      'Web Secretary'
    );
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_type where typname = 'position_role') then
    execute 'alter type position_role add value if not exists ''Official''';
  end if;
end $$;


-- =========================================================
-- 2. profiles テーブルにカラム追加（無ければ追加）
-- =========================================================
alter table public.profiles
  add column if not exists leader leader_role not null default 'none',
  add column if not exists crew   crew_role   not null default 'User',
  add column if not exists part   part_role   not null default 'none',
  add column if not exists muted  boolean     not null default false,
  add column if not exists avatar_url text,
  add column if not exists discord_id text,
  add column if not exists real_name text;


-- =========================================================
-- 2-1. profile_private テーブル（学籍番号を分離）
-- =========================================================
create table if not exists public.profile_private (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  student_id text not null,
  enrollment_year integer,
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profile_private
  add column if not exists enrollment_year integer,
  add column if not exists birth_date date;

create or replace function public.profile_private_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profile_private_set_updated_at on public.profile_private;
create trigger trg_profile_private_set_updated_at
before update on public.profile_private
for each row execute function public.profile_private_set_updated_at();

-- =========================================================
-- 2-2. profile_positions テーブル（複数役職）
-- =========================================================
create table if not exists public.profile_positions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  position position_role not null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_profile_positions_profile_position
  on public.profile_positions(profile_id, position);


-- =========================================================
-- 3. 既存カラムの型が old enum のままなら new enum に変換
-- =========================================================
alter table public.profiles
  alter column leader drop default,
  alter column crew   drop default,
  alter column part   drop default;

-- leader: old → new
alter table public.profiles
  alter column leader type leader_role
  using (
    case leader::text
      when 'Pa_Leader'       then 'PA Leader'
      when 'Lighting_Leader' then 'Lighting Leader'
      when 'Part_Leader'     then 'Part Leader'
      when 'PA Leader'       then 'PA Leader'
      when 'Lighting Leader' then 'Lighting Leader'
      when 'Part Leader'     then 'Part Leader'
      when 'Administrator'   then 'Administrator'
      when 'Supervisor'      then 'Supervisor'
      when 'none'            then 'none'
      else 'none'
    end
  )::leader_role;

-- crew: old → new
alter table public.profiles
  alter column crew type crew_role
  using (
    case crew::text
      when 'Pa' then 'PA'
      else crew::text
    end
  )::crew_role;

-- part: old → new
alter table public.profiles
  alter column part type part_role
  using (part::text)::part_role;

alter table public.profiles
  alter column leader set default 'none'::leader_role,
  alter column crew   set default 'User'::crew_role,
  alter column part   set default 'none'::part_role;

-- =========================================================
-- 4. 判定関数（RLS内でprofilesを直参照しないため SECURITY DEFINER）
-- =========================================================
create or replace function public.is_admin_or_supervisor(uid uuid)
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
      and p.leader in ('Administrator'::leader_role, 'Supervisor'::leader_role)
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
    from public.profiles p
    where p.id = uid
      and p.leader = 'PA Leader'::leader_role
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
    from public.profiles p
    where p.id = uid
      and p.leader = 'Lighting Leader'::leader_role
  );
$$;


-- =========================================================
-- 5. RLS（Row Level Security）設定
-- =========================================================
alter table public.profiles enable row level security;

-- 5-1) 認証済みユーザは全員のプロフィールを閲覧できる
create policy "profiles_select_all_authenticated"
on public.profiles
for select
to authenticated
using ( true );

-- 5-2) 自分のプロフィールは自分で作成してよい（安全な初期値固定）
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = id
  and leader = 'none'::leader_role
  and muted = false
  and crew  = 'User'::crew_role
);

-- 5-3) 自分のプロフィールは自分で更新できる（muted=true の人は更新不可）
create policy "profiles_self_update"
on public.profiles
for update
to authenticated
using ( id = auth.uid() )
with check (
  id = auth.uid()
  and muted is not true
);

-- 5-4) Administrator / Supervisor は全員のプロフィールを更新可能（muted含む）
create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using ( public.is_admin_or_supervisor(auth.uid()) )
with check ( public.is_admin_or_supervisor(auth.uid()) );

-- 5-5) PA長：更新できる（列制限はトリガーで縛る）
create policy "profiles_pa_leader_update_crew"
on public.profiles
for update
to authenticated
using ( public.is_pa_leader(auth.uid()) )
with check ( public.is_pa_leader(auth.uid()) );

-- 5-6) 照明長：更新できる（列制限はトリガーで縛る）
create policy "profiles_lighting_leader_update_crew"
on public.profiles
for update
to authenticated
using ( public.is_lighting_leader(auth.uid()) )
with check ( public.is_lighting_leader(auth.uid()) );


-- 5-7) 学籍番号（profile_private）
alter table public.profile_private enable row level security;

drop policy if exists "profile_private_select_self_or_privileged" on public.profile_private;
drop policy if exists "profile_private_insert_self" on public.profile_private;
drop policy if exists "profile_private_update_self" on public.profile_private;

create policy "profile_private_select_self_or_privileged"
on public.profile_private
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_admin_or_supervisor(auth.uid())
  or public.is_pa_leader(auth.uid())
  or public.is_lighting_leader(auth.uid())
);

create policy "profile_private_insert_self"
on public.profile_private
for insert
to authenticated
with check (profile_id = auth.uid());

create policy "profile_private_update_self"
on public.profile_private
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

-- 5-7-1) 入学年度は全員閲覧できるように RPC で提供
create or replace function public.get_profile_enrollment_years()
returns table (profile_id uuid, enrollment_year integer, birth_date date)
language sql
stable
security definer
set search_path = public
as $$
  select profile_id, enrollment_year, birth_date from public.profile_private;
$$;

revoke execute on function public.get_profile_enrollment_years() from public;
grant execute on function public.get_profile_enrollment_years() to authenticated;

-- 5-8) 役職（profile_positions）
alter table public.profile_positions enable row level security;

drop policy if exists "profile_positions_select_all_authenticated" on public.profile_positions;
drop policy if exists "profile_positions_write_admin" on public.profile_positions;

create policy "profile_positions_select_all_authenticated"
on public.profile_positions
for select
to authenticated
using (true);

create policy "profile_positions_write_admin"
on public.profile_positions
for all
to authenticated
using (public.is_admin_or_supervisor(auth.uid()))
with check (public.is_admin_or_supervisor(auth.uid()));


-- =========================================================
-- 6. トリガーで「列単位の制御」を強制（自己昇格防止）
-- =========================================================
create or replace function public.profiles_block_privilege_escalation()
returns trigger
language plpgsql
as $$
declare
  actor uuid;
  actor_is_admin boolean;
  actor_is_pa_leader boolean;
  actor_is_lighting_leader boolean;
begin
  actor := auth.uid();

  -- Supabase Dashboard / service role 等で auth.uid() が null の操作は許可
  if actor is null then
    return new;
  end if;

  actor_is_admin := public.is_admin_or_supervisor(actor);
  actor_is_pa_leader := public.is_pa_leader(actor);
  actor_is_lighting_leader := public.is_lighting_leader(actor);

  -- Admin/Supervisor はフル権限
  if actor_is_admin then
    return new;
  end if;

  -- INSERT: 一般ユーザは leader/muted/crew を固定（安全）
  if tg_op = 'INSERT' then
    if new.leader <> 'none'::leader_role then
      raise exception 'Only Administrator/Supervisor can set leader role.';
    end if;

    if new.muted <> false then
      raise exception 'Only Administrator/Supervisor can set muted.';
    end if;

    if new.crew <> 'User'::crew_role then
      raise exception 'Only Administrator/Supervisor can set crew on insert.';
    end if;

    return new;
  end if;

  -- UPDATE: leader / muted は admin/supervisor 以外触れない
  if new.leader is distinct from old.leader then
    raise exception 'Only Administrator/Supervisor can change leader role.';
  end if;

  if new.muted is distinct from old.muted then
    raise exception 'Only Administrator/Supervisor can change muted.';
  end if;

  -- UPDATE: crew の変更ルール
  if new.crew is distinct from old.crew then
    -- Self update: allow changing crew freely (enum restriction applies).
    if actor = old.id then
      null;
    -- PA長：PA/User のみ
    elsif actor_is_pa_leader then
      if new.crew not in ('PA'::crew_role, 'User'::crew_role) then
        raise exception 'PA Leader can set crew only to PA/User.';
      end if;

    -- 照明長：Lighting/User のみ
    elsif actor_is_lighting_leader then
      if new.crew not in ('Lighting'::crew_role, 'User'::crew_role) then
        raise exception 'Lighting Leader can set crew only to Lighting/User.';
      end if;

    else
      raise exception 'Only Administrator/Supervisor, self, or relevant leader can change crew.';
    end if;
  end if;

  -- PA長/照明長が「他人の行」を更新する場合：crew 以外の変更禁止
  if actor <> old.id and (actor_is_pa_leader or actor_is_lighting_leader) then
    if (to_jsonb(new) - 'crew' - 'updated_at') <> (to_jsonb(old) - 'crew' - 'updated_at') then
      raise exception 'Leaders can only change crew for other users.';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_profiles_block_privilege_escalation
before insert or update
on public.profiles
for each row
execute function public.profiles_block_privilege_escalation();


-- =========================================================
-- 7. （任意）退避ENUMがもう不要なら消す（依存が残ってたらスキップ）
-- =========================================================
do $$
begin
  begin
    execute 'drop type if exists leader_role_old';
  exception when others then null;
  end;

  begin
    execute 'drop type if exists crew_role_old';
  exception when others then null;
  end;

  begin
    execute 'drop type if exists part_role_old';
  exception when others then null;
  end;
end $$;

-- =========================================================
-- 8. 古い型の片付け
-- =========================================================
do $$
begin
  if exists (select 1 from pg_type where typname = 'part_role_old') then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'part'
    ) then
      execute 'alter table public.profiles alter column part type part_role using (part::text)::part_role';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profile_parts'
        and column_name = 'part'
    ) then
      execute 'alter table public.profile_parts alter column part type part_role using (part::text)::part_role';
    end if;

    execute 'drop type part_role_old';
  end if;
end $$;

commit;

