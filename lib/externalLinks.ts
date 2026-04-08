export type ExternalLinkBadgeVariant = "default" | "secondary" | "outline" | "warning" | "info";
export type ExternalLinkSectionIcon = "globe" | "school" | "library" | "image" | "link" | "file";
export type ExternalLinkSectionLayout = "links" | "groups";

export type ExternalLinkItem = {
  id: string;
  title: string;
  href: string;
  description: string;
  badge: string;
  badgeVariant: ExternalLinkBadgeVariant;
  note: string;
};

export type ExternalLinkGroup = {
  id: string;
  title: string;
  description: string;
  links: ExternalLinkItem[];
};

export type ExternalLinkSection = {
  id: string;
  title: string;
  description: string;
  icon: ExternalLinkSectionIcon;
  layout: ExternalLinkSectionLayout;
  links: ExternalLinkItem[];
  groups: ExternalLinkGroup[];
};

export type ExternalLinkPageContent = {
  title: string;
  description: string;
  sections: ExternalLinkSection[];
};

export const isInternalExternalLinkHref = (href: string) =>
  href.startsWith("/") && !href.startsWith("//");

const badgeVariantSet = new Set<ExternalLinkBadgeVariant>([
  "default",
  "secondary",
  "outline",
  "warning",
  "info",
]);

const sectionIconValues = ["globe", "school", "library", "image", "link", "file"] as const;
const sectionIconSet = new Set<ExternalLinkSectionIcon>(sectionIconValues);
const sectionLayoutSet = new Set<ExternalLinkSectionLayout>(["links", "groups"]);

const createId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const externalLinkBadgeVariantOptions: Array<{
  value: ExternalLinkBadgeVariant;
  label: string;
}> = [
  { value: "default", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "outline", label: "Outline" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];

export const externalLinkSectionIconOptions: Array<{
  value: ExternalLinkSectionIcon;
  label: string;
}> = [
  { value: "globe", label: "公式" },
  { value: "school", label: "大学" },
  { value: "library", label: "アーカイブ" },
  { value: "image", label: "動画" },
  { value: "link", label: "リンク" },
  { value: "file", label: "ファイル" },
];

export const externalLinkSectionLayoutOptions: Array<{
  value: ExternalLinkSectionLayout;
  label: string;
}> = [
  { value: "links", label: "直接リンク" },
  { value: "groups", label: "グループ分け" },
];

export const getDefaultExternalLinkSectionIcon = (index = 0): ExternalLinkSectionIcon =>
  sectionIconValues[index % sectionIconValues.length];

export const createExternalLinkItem = (
  seed: Partial<Omit<ExternalLinkItem, "id">> & { id?: string } = {}
): ExternalLinkItem => ({
  id: seed.id ?? createId("link"),
  title: seed.title ?? "",
  href: seed.href ?? "",
  description: seed.description ?? "",
  badge: seed.badge ?? "リンク",
  badgeVariant: seed.badgeVariant ?? "outline",
  note: seed.note ?? "",
});

export const createExternalLinkGroup = (
  seed: Partial<Omit<ExternalLinkGroup, "id" | "links">> & {
    id?: string;
    links?: ExternalLinkItem[];
  } = {}
): ExternalLinkGroup => ({
  id: seed.id ?? createId("group"),
  title: seed.title ?? "",
  description: seed.description ?? "",
  links: seed.links ? seed.links.map((link) => ({ ...link })) : [],
});

export const createExternalLinkSection = (
  seed: Partial<Omit<ExternalLinkSection, "id" | "links" | "groups">> & {
    id?: string;
    links?: ExternalLinkItem[];
    groups?: ExternalLinkGroup[];
  } = {}
): ExternalLinkSection => ({
  id: seed.id ?? createId("section"),
  title: seed.title ?? "",
  description: seed.description ?? "",
  icon: seed.icon ?? "globe",
  layout: seed.layout ?? "links",
  links: seed.links ? seed.links.map((link) => ({ ...link })) : [],
  groups: seed.groups ? seed.groups.map((group) => ({ ...group, links: group.links.map((link) => ({ ...link })) })) : [],
});

export const EXTERNAL_LINKS_DEFAULT_CONTENT: ExternalLinkPageContent = {
  title: "外部リンク集",
  description:
    "Jacla の公式 SNS、大学ポータル、歴代アーカイブをまとめたページです。必要に応じて外部サイトへ移動してください。",
  sections: [
    createExternalLinkSection({
      id: "official",
      title: "公式アカウント",
      description: "部の告知や新歓情報を確認できる公式 SNS です。",
      icon: "globe",
      layout: "links",
      links: [
        createExternalLinkItem({
          id: "official-x",
          title: "Jacla X",
          href: "https://twitter.com/jacla_circle",
          description: "新歓やイベント情報を追える公式 X アカウントです。",
          badge: "公式",
          badgeVariant: "default",
          note: "東京工科大学のサークル紹介ページと旧公式サイトで案内されているアカウントです。",
        }),
        createExternalLinkItem({
          id: "official-instagram",
          title: "Jacla Instagram",
          href: "https://www.instagram.com/jacla.circle/",
          description: "活動の雰囲気やライブ写真を見られる公式 Instagram です。",
          badge: "公式ハンドル",
          badgeVariant: "secondary",
          note: "大学パンフレット掲載の Instagram ハンドル `jacla.circle` をもとにしています。",
        }),
      ],
    }),
    createExternalLinkSection({
      id: "campus",
      title: "大学・ポータル",
      description: "大学の案内ページや部活紹介の資料へ飛べます。",
      icon: "school",
      layout: "links",
      links: [
        createExternalLinkItem({
          id: "campus-teu",
          title: "東京工科大学 サークル紹介",
          href: "https://www.teu.ac.jp/student/circle/detail.html?id=57",
          description: "大学公式の Jacla 紹介ページです。",
          badge: "大学公式",
          badgeVariant: "info",
        }),
        createExternalLinkItem({
          id: "campus-portal",
          title: "クラブポータル",
          href: "https://clubs.linux.it.teu.ac.jp/",
          description: "部・サークル情報をまとめたポータルです。",
          badge: "学生ポータル",
          badgeVariant: "warning",
          note: "東京工科大学アカウントでのログインが必要です。",
        }),
        createExternalLinkItem({
          id: "campus-pamphlet",
          title: "部・サークル紹介パンフレット",
          href: "https://www.teu.ac.jp/file/h_057_kokadai_circle_2026.pdf",
          description: "最新の大学案内 PDF です。Instagram の掲載情報も確認できます。",
          badge: "PDF",
          badgeVariant: "outline",
        }),
      ],
    }),
    createExternalLinkSection({
      id: "archive",
      title: "アーカイブ",
      description: "歴代の公式サイトや写真アーカイブ、動画アーカイブへの入口です。",
      icon: "library",
      layout: "links",
      links: [
        createExternalLinkItem({
          id: "archive-old-site",
          title: "旧 Jacla サイト",
          href: "https://www2.linux.it.teu.ac.jp/~jacla/",
          description: "以前の公式サイトです。過去の情報や案内を確認できます。",
          badge: "アーカイブ",
          badgeVariant: "outline",
        }),
        createExternalLinkItem({
          id: "archive-tumblr",
          title: "Tumblr 写真アーカイブ",
          href: "http://jacla-photo.tumblr.com",
          description: "旧公式サイトから案内されている写真アーカイブです。",
          badge: "写真",
          badgeVariant: "secondary",
        }),
      ],
    }),
  ],
};

export const YOUTUBE_ARCHIVE_DEFAULT_CONTENT: ExternalLinkPageContent = {
  title: "限定公開動画アーカイブ",
  description:
    "限定公開の YouTube 動画を、年度ごと・ライブごとに整理して置いておくためのページです。ライブ映像と引き継ぎ動画を同じ仕組みで管理できます。",
  sections: [
    createExternalLinkSection({
      id: "archive-2026",
      title: "2026年度",
      description: "年度ごとにセクションを分けて、その中をライブごとのグループで整理します。",
      icon: "image",
      layout: "groups",
      groups: [
        createExternalLinkGroup({
          id: "archive-2026-spring",
          title: "春ライブ",
          description: "このライブに紐づく限定公開動画を追加します。",
        }),
      ],
    }),
    createExternalLinkSection({
      id: "reference-videos",
      title: "引き継ぎ・参考動画",
      description: "機材説明、運営共有、引き継ぎ用の動画をまとめます。",
      icon: "library",
      layout: "links",
      links: [],
    }),
  ],
};

export const ARCHIVE_VIDEO_LIBRARY_LINK = createExternalLinkItem({
  id: "archive-video-library",
  title: "限定公開動画アーカイブ",
  href: "/links/archive",
  description: "限定公開の YouTube 動画をまとめた、ポータル内の専用ページです。",
  badge: "Portal",
  badgeVariant: "info",
  note: "ポータル内の別ページです。年度ごとのライブ動画もここに集約できます。",
});

export const cloneExternalLinkPageContent = (
  content: ExternalLinkPageContent
): ExternalLinkPageContent => ({
  title: content.title,
  description: content.description,
  sections: content.sections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    icon: section.icon,
    layout: section.layout,
    links: section.links.map((link) => ({
      id: link.id,
      title: link.title,
      href: link.href,
      description: link.description,
      badge: link.badge,
      badgeVariant: link.badgeVariant,
      note: link.note,
    })),
    groups: section.groups.map((group) => ({
      id: group.id,
      title: group.title,
      description: group.description,
      links: group.links.map((link) => ({
        id: link.id,
        title: link.title,
        href: link.href,
        description: link.description,
        badge: link.badge,
        badgeVariant: link.badgeVariant,
        note: link.note,
      })),
    })),
  })),
});

export const ensureArchiveVideoLibraryLink = (
  content: ExternalLinkPageContent
): ExternalLinkPageContent => {
  const next = cloneExternalLinkPageContent(content);
  const archiveSectionIndex = next.sections.findIndex((section) => section.id === "archive");

  if (archiveSectionIndex === -1) {
    next.sections.push(
      createExternalLinkSection({
        id: "archive",
        title: "アーカイブ",
        description: "歴代の公式サイトや動画アーカイブへの入口です。",
        icon: "library",
        layout: "links",
        links: [ARCHIVE_VIDEO_LIBRARY_LINK],
      })
    );
    return next;
  }

  const archiveSection = next.sections[archiveSectionIndex];
  const hasVideoLibraryLink = archiveSection.links.some(
    (link) => link.id === ARCHIVE_VIDEO_LIBRARY_LINK.id || link.href === ARCHIVE_VIDEO_LIBRARY_LINK.href
  );

  if (!hasVideoLibraryLink) {
    archiveSection.links = [ARCHIVE_VIDEO_LIBRARY_LINK, ...archiveSection.links];
  }

  return next;
};

const normalizeItem = (value: unknown): ExternalLinkItem => {
  const record = isRecord(value) ? value : {};
  const badgeVariant = badgeVariantSet.has(record.badgeVariant as ExternalLinkBadgeVariant)
    ? (record.badgeVariant as ExternalLinkBadgeVariant)
    : "outline";

  return createExternalLinkItem({
    id: asString(record.id, createId("link")),
    title: asString(record.title),
    href: asString(record.href),
    description: asString(record.description),
    badge: asString(record.badge, "リンク"),
    badgeVariant,
    note: asString(record.note),
  });
};

const normalizeGroup = (value: unknown): ExternalLinkGroup => {
  const record = isRecord(value) ? value : {};
  const links = Array.isArray(record.links) ? record.links.map((link) => normalizeItem(link)) : [];

  return {
    id: asString(record.id, createId("group")),
    title: asString(record.title),
    description: asString(record.description),
    links,
  };
};

const normalizeSection = (value: unknown, index: number): ExternalLinkSection => {
  const record = isRecord(value) ? value : {};
  const links = Array.isArray(record.links) ? record.links.map((link) => normalizeItem(link)) : [];
  const groups = Array.isArray(record.groups)
    ? record.groups.map((group) => normalizeGroup(group))
    : [];
  const icon = sectionIconSet.has(record.icon as ExternalLinkSectionIcon)
    ? (record.icon as ExternalLinkSectionIcon)
    : getDefaultExternalLinkSectionIcon(index);
  const layout = sectionLayoutSet.has(record.layout as ExternalLinkSectionLayout)
    ? (record.layout as ExternalLinkSectionLayout)
    : groups.length > 0
      ? "groups"
      : "links";

  return {
    id: asString(record.id, createId("section")),
    title: asString(record.title),
    description: asString(record.description),
    icon,
    layout,
    links,
    groups,
  };
};

export const normalizeExternalLinkPageContent = (
  value: unknown,
  fallbackContent: ExternalLinkPageContent = EXTERNAL_LINKS_DEFAULT_CONTENT
): ExternalLinkPageContent => {
  const record = isRecord(value) ? value : {};
  const sections = Array.isArray(record.sections)
    ? record.sections.map((section, index) => normalizeSection(section, index))
    : cloneExternalLinkPageContent(fallbackContent).sections;

  return {
    title: asString(record.title, fallbackContent.title),
    description: asString(record.description, fallbackContent.description),
    sections,
  };
};

export const prepareExternalLinkPageContentForSave = (
  content: ExternalLinkPageContent
): ExternalLinkPageContent => ({
  title: content.title.trim(),
  description: content.description.trim(),
  sections: content.sections.map((section, index) => ({
    id: section.id.trim() || createId("section"),
    title: section.title.trim(),
    description: section.description.trim(),
    icon: sectionIconSet.has(section.icon) ? section.icon : getDefaultExternalLinkSectionIcon(index),
    layout: sectionLayoutSet.has(section.layout) ? section.layout : "links",
    links: section.links.map((link) => ({
      id: link.id.trim() || createId("link"),
      title: link.title.trim(),
      href: link.href.trim(),
      description: link.description.trim(),
      badge: link.badge.trim() || "リンク",
      badgeVariant: link.badgeVariant,
      note: link.note.trim(),
    })),
    groups: section.groups.map((group) => ({
      id: group.id.trim() || createId("group"),
      title: group.title.trim(),
      description: group.description.trim(),
      links: group.links.map((link) => ({
        id: link.id.trim() || createId("link"),
        title: link.title.trim(),
        href: link.href.trim(),
        description: link.description.trim(),
        badge: link.badge.trim() || "リンク",
        badgeVariant: link.badgeVariant,
        note: link.note.trim(),
      })),
    })),
  })),
});

const validateLink = (link: ExternalLinkItem): string | null => {
  if (!link.title.trim()) return "リンク名を入力してください。";

  const href = link.href.trim();
  if (!href) {
    return `「${link.title.trim() || "新しいリンク"}」の URL を入力してください。`;
  }

  if (isInternalExternalLinkHref(href)) return null;

  try {
    const url = new URL(href);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return `「${link.title.trim()}」の URL は http / https のみ対応です。`;
    }
  } catch {
    return `「${link.title.trim() || "新しいリンク"}」の URL が不正です。`;
  }

  return null;
};

export const validateExternalLinkPageContent = (content: ExternalLinkPageContent): string | null => {
  if (!content.title.trim()) return "ページタイトルを入力してください。";
  if (!content.description.trim()) return "ページ説明を入力してください。";
  if (content.sections.length === 0) return "少なくとも1つはセクションを追加してください。";

  for (const section of content.sections) {
    if (!section.title.trim()) return "セクション名を入力してください。";

    if (section.layout === "groups") {
      for (const group of section.groups) {
        if (!group.title.trim()) return "グループ名を入力してください。";

        for (const link of group.links) {
          const error = validateLink(link);
          if (error) return error;
        }
      }
      continue;
    }

    for (const link of section.links) {
      const error = validateLink(link);
      if (error) return error;
    }
  }

  return null;
};
