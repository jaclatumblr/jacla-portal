begin;

create table if not exists public.external_link_pages (
  id smallint primary key default 1,
  title text not null default '外部リンク集',
  description text not null default '',
  sections jsonb not null default '[]'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.external_link_pages (id, title, description, sections)
values (
  1,
  '外部リンク集',
  'Jacla の公開 SNS、大学掲載ページ、アーカイブ先をまとめています。すべて外部サイトへ遷移します。',
  $$[
    {
      "id": "official",
      "title": "公式アカウント",
      "description": "外向けの発信先。SNS の導線をここにまとめています。",
      "links": [
        {
          "id": "official-x",
          "title": "Jacla X",
          "href": "https://twitter.com/jacla_circle",
          "description": "告知や更新を追いやすい公式 X アカウントです。",
          "badge": "公式",
          "badgeVariant": "default",
          "note": "東京工科大学のサークル紹介ページと旧公式サイトで案内されています。"
        },
        {
          "id": "official-instagram",
          "title": "Jacla Instagram",
          "href": "https://www.instagram.com/jacla.circle/",
          "description": "活動の雰囲気を見やすい写真系の導線です。",
          "badge": "公式ハンドル",
          "badgeVariant": "secondary",
          "note": "大学パンフレット掲載の Instagram ハンドル `jacla.circle` をもとにリンク化しています。"
        }
      ]
    },
    {
      "id": "campus",
      "title": "大学・ポータル",
      "description": "大学側の紹介ページと、学内向けポータルへの導線です。",
      "links": [
        {
          "id": "campus-teu",
          "title": "東京工科大学 サークル紹介",
          "href": "https://www.teu.ac.jp/student/circle/detail.html?id=57",
          "description": "活動内容、活動日時、活動場所などの公式紹介ページです。",
          "badge": "大学公式",
          "badgeVariant": "info",
          "note": ""
        },
        {
          "id": "campus-portal",
          "title": "クラブポータル",
          "href": "https://clubs.linux.it.teu.ac.jp/",
          "description": "部・サークルの情報がまとまったポータルです。",
          "badge": "学内向け",
          "badgeVariant": "warning",
          "note": "大学アカウントでのログインが必要です。"
        },
        {
          "id": "campus-pamphlet",
          "title": "部・サークル紹介パンフレット",
          "href": "https://www.teu.ac.jp/file/h_057_kokadai_circle_2026.pdf",
          "description": "最新の大学配布 PDF。X と Instagram の掲載元として使えます。",
          "badge": "PDF",
          "badgeVariant": "outline",
          "note": ""
        }
      ]
    },
    {
      "id": "archive",
      "title": "アーカイブ",
      "description": "過去の公開サイトや写真アーカイブです。",
      "links": [
        {
          "id": "archive-old-site",
          "title": "旧Jaclaサイト",
          "href": "https://www2.linux.it.teu.ac.jp/~jacla/",
          "description": "以前の公開サイト。旧 X 導線や写真導線も残っています。",
          "badge": "アーカイブ",
          "badgeVariant": "outline",
          "note": ""
        },
        {
          "id": "archive-tumblr",
          "title": "Tumblr 写真アーカイブ",
          "href": "http://jacla-photo.tumblr.com",
          "description": "旧公式サイトから案内されている写真アーカイブです。",
          "badge": "写真",
          "badgeVariant": "secondary",
          "note": ""
        }
      ]
    }
  ]$$::jsonb
)
on conflict (id) do nothing;

create or replace function public.can_manage_external_links(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_or_supervisor(uid)
    or public.is_pa_leader(uid)
    or public.is_lighting_leader(uid);
$$;

create or replace function public.external_link_pages_set_updated()
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

drop trigger if exists trg_external_link_pages_updated on public.external_link_pages;
create trigger trg_external_link_pages_updated
before insert or update on public.external_link_pages
for each row execute function public.external_link_pages_set_updated();

alter table public.external_link_pages enable row level security;

drop policy if exists "external_link_pages_select_all" on public.external_link_pages;
drop policy if exists "external_link_pages_insert_editor" on public.external_link_pages;
drop policy if exists "external_link_pages_update_editor" on public.external_link_pages;

create policy "external_link_pages_select_all"
on public.external_link_pages
for select
to authenticated
using (true);

create policy "external_link_pages_insert_editor"
on public.external_link_pages
for insert
to authenticated
with check (public.can_manage_external_links(auth.uid()));

create policy "external_link_pages_update_editor"
on public.external_link_pages
for update
to authenticated
using (public.can_manage_external_links(auth.uid()))
with check (public.can_manage_external_links(auth.uid()));

commit;
