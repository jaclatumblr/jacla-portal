"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "@/lib/icons";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Globe2,
  ImageIcon,
  LibraryBig,
  Link2,
  PencilLine,
  Plus,
  RotateCcw,
  Save,
  School,
  Trash2,
  X,
} from "@/lib/icons";
import { AuthGuard } from "@/lib/AuthGuard";
import { PageHeader } from "@/components/PageHeader";
import { SideNav } from "@/components/SideNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  cloneExternalLinkPageContent,
  createExternalLinkGroup,
  createExternalLinkItem,
  createExternalLinkSection,
  ensureArchiveVideoLibraryLink,
  externalLinkBadgeVariantOptions,
  externalLinkSectionIconOptions,
  externalLinkSectionLayoutOptions,
  getDefaultExternalLinkSectionIcon,
  isInternalExternalLinkHref,
  normalizeExternalLinkPageContent,
  prepareExternalLinkPageContentForSave,
  type ExternalLinkBadgeVariant,
  type ExternalLinkGroup,
  type ExternalLinkItem,
  type ExternalLinkPageContent,
  type ExternalLinkSection,
  type ExternalLinkSectionIcon,
  type ExternalLinkSectionLayout,
  validateExternalLinkPageContent,
} from "@/lib/externalLinks";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { cn } from "@/lib/utils";

type ExternalLinkPageRow = {
  title: string | null;
  description: string | null;
  sections: unknown;
  updated_at: string | null;
};

type PageActionIconName = "external" | "left" | "right";

type ExternalLinksPageAction = {
  label: string;
  href: string;
  external?: boolean;
  variant?: "default" | "outline";
  icon?: PageActionIconName;
};

type ExternalLinksPageClientProps = {
  pageId: number;
  defaultContent: ExternalLinkPageContent;
  kicker: string;
  introSummary: string;
  introDetail: string;
  actions?: ExternalLinksPageAction[];
  appendArchiveVideoLibraryLink?: boolean;
  allowSectionGrouping?: boolean;
};

const sectionIconMap: Record<ExternalLinkSectionIcon, LucideIcon> = {
  globe: Globe2,
  school: School,
  library: LibraryBig,
  image: ImageIcon,
  link: Link2,
  file: FileText,
};

const actionIconMap: Record<PageActionIconName, LucideIcon> = {
  external: ExternalLink,
  left: ArrowLeft,
  right: ArrowRight,
};

const sectionToneClasses = [
  "border-primary/15 bg-primary/10 text-primary",
  "border-secondary/15 bg-secondary/10 text-secondary",
  "border-info/15 bg-info/10 text-info",
  "border-border bg-surface-secondary text-foreground",
];

const moveItem = <T,>(items: T[], from: number, to: number) => {
  if (to < 0 || to >= items.length || from === to) return items;

  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

const formatSavedAt = (value: string | null) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString("ja-JP");
};

const getSectionIconComponent = (icon: ExternalLinkSectionIcon) => sectionIconMap[icon] ?? Globe2;
const getActionIconComponent = (icon: PageActionIconName = "external") => actionIconMap[icon];
const getGroupAccordionKey = (sectionId: string, groupId: string) => `${sectionId}:${groupId}`;

const getFaviconSrc = (href: string) => {
  if (!href || isInternalExternalLinkHref(href)) return null;

  try {
    return `${new URL(href).origin}/favicon.ico`;
  } catch {
    return null;
  }
};

function LinkFavicon({ href, title }: { href: string; title: string }) {
  const isInternal = isInternalExternalLinkHref(href);
  const src = useMemo(() => getFaviconSrc(href), [href]);
  const [hasError, setHasError] = useState(false);

  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-card text-muted-foreground"
      title={title}
    >
      {src && !hasError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="h-4 w-4 object-contain"
          onError={() => setHasError(true)}
        />
      ) : isInternal ? (
        <Link2 className="h-3.5 w-3.5" />
      ) : (
        <Globe2 className="h-3.5 w-3.5" />
      )}
    </span>
  );
}

function LinkCard({
  href,
  title,
  description,
  badge,
  badgeVariant,
  note,
  sectionIcon: SectionIcon,
}: {
  href: string;
  title: string;
  description: string;
  badge: string;
  badgeVariant: ExternalLinkBadgeVariant;
  note: string;
  sectionIcon: LucideIcon;
}) {
  const isInternal = isInternalExternalLinkHref(href);
  const ActionIcon = isInternal ? ArrowRight : ExternalLink;
  const safeHref = href || "#";
  const hrefLabel = isInternal ? `Portal: ${safeHref}` : safeHref;
  const cardBody = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <LinkFavicon href={safeHref} title={title || "Link"} />
            <h2 className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
              {title || "新しいリンク"}
            </h2>
            <Badge variant={badgeVariant}>{badge || "リンク"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {description || "リンク説明はまだ設定されていません。"}
          </p>
          {note && <p className="text-xs leading-5 text-muted-foreground">{note}</p>}
        </div>
        <div className="rounded-full border border-border/70 p-2 text-muted-foreground transition-all group-hover:border-primary/25 group-hover:text-primary">
          <ActionIcon className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-primary/85">
        <SectionIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="break-all">{hrefLabel || "URL 未設定"}</span>
      </div>
    </>
  );

  const className =
    "group block rounded-2xl border border-border/75 bg-background/80 p-4 transition-colors hover:border-primary/30 hover:bg-surface-hover";

  if (!href) {
    return <div className={className}>{cardBody}</div>;
  }

  if (isInternal) {
    return (
      <Link href={safeHref} className={className}>
        {cardBody}
      </Link>
    );
  }

  return (
    <a href={safeHref} target="_blank" rel="noreferrer" className={className}>
      {cardBody}
    </a>
  );
}

function EditableLinkCard({
  heading,
  link,
  disableUp,
  disableDown,
  onMoveUp,
  onMoveDown,
  onRemove,
  onChange,
}: {
  heading: string;
  link: ExternalLinkItem;
  disableUp: boolean;
  disableDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onChange: (
    field: "title" | "href" | "description" | "badge" | "badgeVariant" | "note",
    value: string
  ) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/75 bg-card/90 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-foreground">{heading}</div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onMoveUp} disabled={disableUp}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onMoveDown} disabled={disableDown}>
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onRemove} className="gap-2">
            <Trash2 className="h-4 w-4" />
            削除
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">リンク名</span>
          <Input value={link.title} onChange={(event) => onChange("title", event.target.value)} placeholder="例: 春ライブ本編" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">バッジ</span>
          <Input value={link.badge} onChange={(event) => onChange("badge", event.target.value)} placeholder="例: YouTube" />
        </label>
        <label className="space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-foreground">URL</span>
          <Input value={link.href} onChange={(event) => onChange("href", event.target.value)} placeholder="https://..." />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">バッジ色</span>
          <Select
            value={link.badgeVariant}
            onValueChange={(value) => onChange("badgeVariant", value)}
            options={externalLinkBadgeVariantOptions}
            aria-label="バッジ色を選択"
          />
        </label>
        <label className="space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-foreground">説明</span>
          <Textarea
            value={link.description}
            onChange={(event) => onChange("description", event.target.value)}
            placeholder="カードに表示する説明"
            className="min-h-[88px]"
          />
        </label>
        <label className="space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-foreground">補足</span>
          <Textarea
            value={link.note}
            onChange={(event) => onChange("note", event.target.value)}
            placeholder="補足メモ"
            className="min-h-[84px]"
          />
        </label>
      </div>
    </div>
  );
}

export function ExternalLinksPageClient({
  pageId,
  defaultContent,
  kicker,
  introSummary,
  introDetail,
  actions = [],
  appendArchiveVideoLibraryLink = false,
  allowSectionGrouping = false,
}: ExternalLinksPageClientProps) {
  const { isAdmin, isPaLeader, isLightingLeader, loading: roleLoading } = useRoleFlags();
  const canEditContent = isAdmin || isPaLeader || isLightingLeader;

  const createDefaultContent = () => cloneExternalLinkPageContent(defaultContent);

  const [content, setContent] = useState<ExternalLinkPageContent>(() => createDefaultContent());
  const [draft, setDraft] = useState<ExternalLinkPageContent>(() => createDefaultContent());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorMode, setEditorMode] = useState(false);
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [openEditorGroupKey, setOpenEditorGroupKey] = useState<string | null>(null);
  const [openDisplayGroupKey, setOpenDisplayGroupKey] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("external_link_pages")
        .select("title, description, sections, updated_at")
        .eq("id", pageId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error(error);
        setStorageNotice(
          "保存テーブルが未適用の可能性があります。SQL/ExternalLinks.sql を適用すると編集内容を保存できます。"
        );
        setContent(createDefaultContent());
        setDraft(createDefaultContent());
        setLastSavedAt(null);
        setLoading(false);
        return;
      }

      if (!data) {
        setStorageNotice(null);
        setContent(createDefaultContent());
        setDraft(createDefaultContent());
        setLastSavedAt(null);
        setLoading(false);
        return;
      }

      const normalized = normalizeExternalLinkPageContent(data as ExternalLinkPageRow, defaultContent);
      setStorageNotice(null);
      setContent(normalized);
      setDraft(cloneExternalLinkPageContent(normalized));
      setLastSavedAt((data as ExternalLinkPageRow).updated_at ?? null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [defaultContent, pageId]);

  const visibleContent = useMemo(() => {
    if (editorMode) return draft;
    return appendArchiveVideoLibraryLink ? ensureArchiveVideoLibraryLink(content) : content;
  }, [appendArchiveVideoLibraryLink, content, draft, editorMode]);

  useEffect(() => {
    if (editorMode) return;

    const groupKeys = visibleContent.sections.flatMap((section) =>
      section.layout === "groups"
        ? section.groups.map((group) => getGroupAccordionKey(section.id, group.id))
        : []
    );

    if (groupKeys.length === 0) {
      if (openDisplayGroupKey !== null) {
        setOpenDisplayGroupKey(null);
      }
      return;
    }

    if (openDisplayGroupKey && !groupKeys.includes(openDisplayGroupKey)) {
      setOpenDisplayGroupKey(groupKeys[0]);
    }
  }, [editorMode, openDisplayGroupKey, visibleContent]);

  const activeOpenSectionId =
    editorMode && draft.sections.some((section) => section.id === openSectionId)
      ? openSectionId
      : draft.sections[0]?.id ?? null;
  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(content), [content, draft]);
  const savedAtLabel = useMemo(() => formatSavedAt(lastSavedAt), [lastSavedAt]);

  const openEditor = () => {
    setDraft(cloneExternalLinkPageContent(content));
    setOpenSectionId(content.sections[0]?.id ?? null);
    setOpenEditorGroupKey(null);
    setEditorMode(true);
  };

  const closeEditor = () => {
    setDraft(cloneExternalLinkPageContent(content));
    setOpenSectionId(null);
    setOpenEditorGroupKey(null);
    setEditorMode(false);
  };

  const resetDraftToDefault = () => {
    const nextDraft = createDefaultContent();
    setDraft(nextDraft);
    setOpenSectionId(nextDraft.sections[0]?.id ?? null);
    setOpenEditorGroupKey(null);
  };

  const handleSave = async () => {
    if (!canEditContent || saving) return;

    const nextContent = prepareExternalLinkPageContentForSave(draft);
    const validationError = validateExternalLinkPageContent(nextContent);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("external_link_pages")
      .upsert(
        {
          id: pageId,
          title: nextContent.title,
          description: nextContent.description,
          sections: nextContent.sections,
        },
        { onConflict: "id" }
      )
      .select("updated_at")
      .single();

    if (error) {
      console.error(error);
      if (error.code === "42P01") {
        toast.error("保存テーブルがありません。SQL/ExternalLinks.sql を適用してください。");
      } else {
        toast.error("リンクページの保存に失敗しました。");
      }
      setSaving(false);
      return;
    }

    setContent(nextContent);
    setDraft(cloneExternalLinkPageContent(nextContent));
    setLastSavedAt((data as { updated_at?: string | null } | null)?.updated_at ?? new Date().toISOString());
    setStorageNotice(null);
    setEditorMode(false);
    setSaving(false);
    toast.success("リンクページを保存しました。");
  };

  const updateDraftMeta = (field: "title" | "description", value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateSectionField = (
    sectionIndex: number,
    field: "title" | "description",
    value: string
  ) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section, index) =>
        index === sectionIndex ? { ...section, [field]: value } : section
      ),
    }));
  };

  const updateSectionIcon = (sectionIndex: number, icon: ExternalLinkSectionIcon) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section, index) =>
        index === sectionIndex ? { ...section, icon } : section
      ),
    }));
  };

  const updateSectionLayout = (sectionIndex: number, layout: ExternalLinkSectionLayout) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section, index) => {
        if (index !== sectionIndex || section.layout === layout) return section;

        if (layout === "groups") {
          return {
            ...section,
            layout,
            groups:
              section.groups.length > 0
                ? section.groups
                : section.links.length > 0
                  ? [
                      createExternalLinkGroup({
                        title: "新しいライブ",
                        links: section.links,
                      }),
                    ]
                  : [],
            links: [],
          };
        }

        return {
          ...section,
          layout,
          links:
            section.links.length > 0
              ? section.links
              : section.groups.flatMap((group) => group.links),
          groups: [],
        };
      }),
    }));
  };

  const addSection = () => {
    const nextSection = createExternalLinkSection({
      icon: getDefaultExternalLinkSectionIcon(draft.sections.length),
    });

    setDraft((prev) => ({
      ...prev,
      sections: [...prev.sections, nextSection],
    }));
    setOpenSectionId(nextSection.id);
  };

  const removeSection = (sectionIndex: number) => {
    setDraft((prev) => {
      const nextSections = prev.sections.filter((_, index) => index !== sectionIndex);
      const nextOpenSection = nextSections[sectionIndex] ?? nextSections[sectionIndex - 1] ?? null;
      setOpenSectionId(nextOpenSection?.id ?? null);

      return {
        ...prev,
        sections: nextSections,
      };
    });
  };

  const moveSection = (sectionIndex: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? sectionIndex - 1 : sectionIndex + 1;

    setDraft((prev) => ({
      ...prev,
      sections: moveItem(prev.sections, sectionIndex, nextIndex),
    }));
  };

  const addLink = (sectionIndex: number) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              links: [...section.links, createExternalLinkItem()],
            }
          : section
      ),
    }));
  };

  const updateLinkField = (
    sectionIndex: number,
    linkIndex: number,
    field: "title" | "href" | "description" | "badge" | "badgeVariant" | "note",
    value: string
  ) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              links: section.links.map((link, currentLinkIndex) =>
                currentLinkIndex === linkIndex ? { ...link, [field]: value } : link
              ),
            }
          : section
      ),
    }));
  };

  const removeLink = (sectionIndex: number, linkIndex: number) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              links: section.links.filter((_, currentLinkIndex) => currentLinkIndex !== linkIndex),
            }
          : section
      ),
    }));
  };

  const moveLink = (sectionIndex: number, linkIndex: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? linkIndex - 1 : linkIndex + 1;

    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              links: moveItem(section.links, linkIndex, nextIndex),
            }
          : section
      ),
    }));
  };

  const addGroup = (sectionIndex: number) => {
    const sectionId = draft.sections[sectionIndex]?.id ?? null;
    const nextGroup = createExternalLinkGroup({ title: "新しいライブ" });

    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              groups: [...section.groups, nextGroup],
            }
          : section
      ),
    }));

    if (sectionId) {
      setOpenEditorGroupKey(getGroupAccordionKey(sectionId, nextGroup.id));
    }
  };

  const updateGroupField = (
    sectionIndex: number,
    groupIndex: number,
    field: "title" | "description",
    value: string
  ) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              groups: section.groups.map((group, currentGroupIndex) =>
                currentGroupIndex === groupIndex ? { ...group, [field]: value } : group
              ),
            }
          : section
      ),
    }));
  };

  const removeGroup = (sectionIndex: number, groupIndex: number) => {
    const sectionId = draft.sections[sectionIndex]?.id ?? null;
    const removingGroupId = draft.sections[sectionIndex]?.groups[groupIndex]?.id ?? null;

    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              groups: section.groups.filter((_, currentGroupIndex) => currentGroupIndex !== groupIndex),
            }
          : section
      ),
    }));

    if (sectionId && removingGroupId) {
      const removingKey = getGroupAccordionKey(sectionId, removingGroupId);
      setOpenEditorGroupKey((current) => (current === removingKey ? null : current));
      setOpenDisplayGroupKey((current) => (current === removingKey ? null : current));
    }
  };

  const moveGroup = (sectionIndex: number, groupIndex: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? groupIndex - 1 : groupIndex + 1;

    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              groups: moveItem(section.groups, groupIndex, nextIndex),
            }
          : section
      ),
    }));
  };

  const addGroupLink = (sectionIndex: number, groupIndex: number) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              groups: section.groups.map((group, currentGroupIndex) =>
                currentGroupIndex === groupIndex
                  ? {
                      ...group,
                      links: [...group.links, createExternalLinkItem()],
                    }
                  : group
              ),
            }
          : section
      ),
    }));
  };

  const updateGroupLinkField = (
    sectionIndex: number,
    groupIndex: number,
    linkIndex: number,
    field: "title" | "href" | "description" | "badge" | "badgeVariant" | "note",
    value: string
  ) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              groups: section.groups.map((group, currentGroupIndex) =>
                currentGroupIndex === groupIndex
                  ? {
                      ...group,
                      links: group.links.map((link, currentLinkIndex) =>
                        currentLinkIndex === linkIndex ? { ...link, [field]: value } : link
                      ),
                    }
                  : group
              ),
            }
          : section
      ),
    }));
  };

  const removeGroupLink = (sectionIndex: number, groupIndex: number, linkIndex: number) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              groups: section.groups.map((group, currentGroupIndex) =>
                currentGroupIndex === groupIndex
                  ? {
                      ...group,
                      links: group.links.filter((_, currentLinkIndex) => currentLinkIndex !== linkIndex),
                    }
                  : group
              ),
            }
          : section
      ),
    }));
  };

  const moveGroupLink = (
    sectionIndex: number,
    groupIndex: number,
    linkIndex: number,
    direction: "up" | "down"
  ) => {
    const nextIndex = direction === "up" ? linkIndex - 1 : linkIndex + 1;

    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              groups: section.groups.map((group, currentGroupIndex) =>
                currentGroupIndex === groupIndex
                  ? {
                      ...group,
                      links: moveItem(group.links, linkIndex, nextIndex),
                    }
                  : group
              ),
            }
          : section
      ),
    }));
  };

  const renderLinkEditorList = (
    links: ExternalLinkItem[],
    onAdd: () => void,
    onChange: (
      linkIndex: number,
      field: "title" | "href" | "description" | "badge" | "badgeVariant" | "note",
      value: string
    ) => void,
    onRemove: (linkIndex: number) => void,
    onMove: (linkIndex: number, direction: "up" | "down") => void,
    labelPrefix: string
  ) => {
    if (links.length === 0) {
      return (
        <div className="space-y-3">
          <div className="rounded-2xl border border-dashed border-border/80 px-4 py-6 text-sm text-muted-foreground">
            まだリンクがありません。
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            リンク追加
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {links.map((link, linkIndex) => (
          <EditableLinkCard
            key={link.id}
            heading={`${labelPrefix} ${linkIndex + 1}`}
            link={link}
            disableUp={linkIndex === 0}
            disableDown={linkIndex === links.length - 1}
            onMoveUp={() => onMove(linkIndex, "up")}
            onMoveDown={() => onMove(linkIndex, "down")}
            onRemove={() => onRemove(linkIndex)}
            onChange={(field, value) => onChange(linkIndex, field, value)}
          />
        ))}
        <Button type="button" size="sm" variant="outline" onClick={onAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          リンク追加
        </Button>
      </div>
    );
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker={kicker}
            title={visibleContent.title}
            description={visibleContent.description}
            meta={
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">リンクページ</Badge>
                <Badge variant="outline">ポータル管理対応</Badge>
                {loading && <Badge variant="outline">読み込み中</Badge>}
                {editorMode && <Badge variant="info">編集中</Badge>}
                {canEditContent && !roleLoading && (
                  <Badge variant="warning">Admin / SV / PAL / LL 編集可</Badge>
                )}
              </div>
            }
            actions={
              editorMode ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={handleSave} disabled={saving} className="gap-2">
                    <Save className="h-4 w-4" />
                    {saving ? "保存中..." : "保存"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeEditor}
                    disabled={saving}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    キャンセル
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {actions.map((action) => {
                    const Icon = getActionIconComponent(action.icon);
                    const variant = action.variant === "outline" ? "outline" : undefined;

                    return (
                      <Button
                        key={`${action.href}:${action.label}`}
                        asChild
                        variant={variant}
                        className="gap-2"
                      >
                        {action.external ? (
                          <a href={action.href} target="_blank" rel="noreferrer">
                            {action.label}
                            <Icon className="h-4 w-4" />
                          </a>
                        ) : (
                          <Link href={action.href}>
                            {action.label}
                            <Icon className="h-4 w-4" />
                          </Link>
                        )}
                      </Button>
                    );
                  })}
                  {canEditContent && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={openEditor}
                      disabled={roleLoading}
                      className="gap-2"
                    >
                      <PencilLine className="h-4 w-4" />
                      編集モード
                    </Button>
                  )}
                </div>
              )
            }
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto space-y-6 px-4 sm:px-6">
              <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/10 via-card to-secondary/12">
                <CardContent className="grid gap-4 pt-5 md:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
                  <div className="space-y-2">
                    <p className="text-sm text-foreground">{introSummary}</p>
                    <p className="text-sm text-muted-foreground">{introDetail}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <FileText className="h-4 w-4 text-primary" />
                      編集メモ
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      権限のある担当者だけが編集できます。保存すると公開表示にそのまま反映されます。
                    </p>
                    {savedAtLabel && (
                      <p className="mt-3 text-xs text-muted-foreground">最終保存: {savedAtLabel}</p>
                    )}
                    {storageNotice && (
                      <p className="mt-3 text-xs text-warning-foreground">{storageNotice}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {canEditContent && editorMode && (
                <Card className="border-primary/20 bg-card/85 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">編集モード</CardTitle>
                    <CardDescription>
                      セクションとリンクをその場で編集できます。動画アーカイブでは年度ごとのセクションと、ライブごとのグループ分けも使えます。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">ページタイトル</span>
                        <Input
                          value={draft.title}
                          onChange={(event) => updateDraftMeta("title", event.target.value)}
                          placeholder="外部リンク集"
                        />
                      </label>
                      <label className="space-y-2 lg:col-span-2">
                        <span className="text-sm font-medium text-foreground">ページ説明</span>
                        <Textarea
                          value={draft.description}
                          onChange={(event) => updateDraftMeta("description", event.target.value)}
                          placeholder="ページ冒頭に表示する説明"
                          className="min-h-[88px]"
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={addSection} className="gap-2">
                        <Plus className="h-4 w-4" />
                        セクション追加
                      </Button>
                      <Button type="button" variant="outline" onClick={resetDraftToDefault} className="gap-2">
                        <RotateCcw className="h-4 w-4" />
                        初期状態に戻す
                      </Button>
                      <Button type="button" onClick={handleSave} disabled={saving || !isDirty} className="gap-2">
                        <Save className="h-4 w-4" />
                        {saving ? "保存中..." : "変更を保存"}
                      </Button>
                    </div>

                    {draft.sections.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/80 px-5 py-8 text-center text-sm text-muted-foreground">
                        まだセクションがありません。「セクション追加」から作成してください。
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {draft.sections.map((section, sectionIndex) => {
                          const SectionIcon = getSectionIconComponent(section.icon);
                          const sectionToneClass = sectionToneClasses[sectionIndex % sectionToneClasses.length];

                          return (
                            <Collapsible
                              key={section.id}
                              open={activeOpenSectionId === section.id}
                              onOpenChange={(open) => setOpenSectionId(open ? section.id : null)}
                            >
                              <Card className="border-border/80 bg-card/80">
                                <CollapsibleTrigger className="rounded-none border-0 bg-transparent px-5 py-5 shadow-none hover:bg-surface-hover/50">
                                  <div className="flex w-full items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-start gap-3">
                                      <div
                                        className={cn(
                                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                                          sectionToneClass
                                        )}
                                      >
                                        <SectionIcon className="h-4 w-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <CardTitle className="truncate text-base">
                                          {section.title || `セクション ${sectionIndex + 1}`}
                                        </CardTitle>
                                        <CardDescription className="truncate">
                                          {section.description || "セクション説明はまだ未設定です。"}
                                        </CardDescription>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline">
                                        {section.layout === "groups" ? `${section.groups.length} groups` : `${section.links.length} links`}
                                      </Badge>
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="px-6 pb-6">
                                  <div className="space-y-4">
                                    <div className="flex flex-wrap justify-between gap-2">
                                      <div className="flex flex-wrap gap-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => moveSection(sectionIndex, "up")}
                                          disabled={sectionIndex === 0}
                                        >
                                          <ChevronUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => moveSection(sectionIndex, "down")}
                                          disabled={sectionIndex === draft.sections.length - 1}
                                        >
                                          <ChevronDown className="h-4 w-4" />
                                        </Button>
                                        {allowSectionGrouping && section.layout === "groups" ? (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => addGroup(sectionIndex)}
                                            className="gap-2"
                                          >
                                            <Plus className="h-4 w-4" />
                                            ライブ追加
                                          </Button>
                                        ) : (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => addLink(sectionIndex)}
                                            className="gap-2"
                                          >
                                            <Plus className="h-4 w-4" />
                                            リンク追加
                                          </Button>
                                        )}
                                      </div>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => removeSection(sectionIndex)}
                                        className="gap-2"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        セクション削除
                                      </Button>
                                    </div>

                                    <div className="space-y-3">
                                      <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-foreground">セクションアイコン</span>
                                        <div
                                          className={cn(
                                            "flex h-10 w-10 items-center justify-center rounded-xl border",
                                            sectionToneClass
                                          )}
                                        >
                                          <SectionIcon className="h-4 w-4" />
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {externalLinkSectionIconOptions.map((iconOption) => {
                                          const OptionIcon = getSectionIconComponent(iconOption.value);
                                          const isSelected = section.icon === iconOption.value;

                                          return (
                                            <button
                                              key={iconOption.value}
                                              type="button"
                                              onClick={() => updateSectionIcon(sectionIndex, iconOption.value)}
                                              className={cn(
                                                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                                                isSelected
                                                  ? "border-primary/30 bg-primary/10 text-primary"
                                                  : "border-border/80 bg-card/85 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                                              )}
                                              aria-pressed={isSelected}
                                            >
                                              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-current/15 bg-background/80">
                                                <OptionIcon className="h-4 w-4" />
                                              </span>
                                              <span>{iconOption.label}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="grid gap-4 lg:grid-cols-2">
                                      <label className="space-y-2">
                                        <span className="text-sm font-medium text-foreground">セクション名</span>
                                        <Input
                                          value={section.title}
                                          onChange={(event) =>
                                            updateSectionField(sectionIndex, "title", event.target.value)
                                          }
                                          placeholder="例: 2026年度"
                                        />
                                      </label>
                                      {allowSectionGrouping && (
                                        <label className="space-y-2">
                                          <span className="text-sm font-medium text-foreground">表示方式</span>
                                          <Select
                                            value={section.layout}
                                            onValueChange={(value) =>
                                              updateSectionLayout(sectionIndex, value as ExternalLinkSectionLayout)
                                            }
                                            options={externalLinkSectionLayoutOptions}
                                            aria-label="表示方式を選択"
                                          />
                                        </label>
                                      )}
                                      <label className="space-y-2 lg:col-span-2">
                                        <span className="text-sm font-medium text-foreground">説明</span>
                                        <Textarea
                                          value={section.description}
                                          onChange={(event) =>
                                            updateSectionField(sectionIndex, "description", event.target.value)
                                          }
                                          placeholder="セクションの説明"
                                          className="min-h-[88px]"
                                        />
                                      </label>
                                    </div>

                                    {section.layout === "groups" ? (
                                      section.groups.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-border/80 px-4 py-6 text-sm text-muted-foreground">
                                          まだライブグループがありません。「ライブ追加」から作成してください。
                                        </div>
                                      ) : (
                                        <div className="space-y-4">
                                          {section.groups.map((group, groupIndex) => {
                                            const groupKey = getGroupAccordionKey(section.id, group.id);

                                            return (
                                            <Collapsible
                                              key={group.id}
                                              open={openEditorGroupKey === groupKey}
                                              onOpenChange={(open) =>
                                                setOpenEditorGroupKey(open ? groupKey : null)
                                              }
                                            >
                                              <CollapsibleTrigger className="rounded-2xl border border-border/75 bg-card/90 px-4 py-4 shadow-none hover:bg-surface-hover/50">
                                                <div className="flex w-full items-start justify-between gap-3">
                                                  <div className="min-w-0">
                                                    <div className="text-sm font-medium text-foreground">
                                                      ライブ {groupIndex + 1}
                                                    </div>
                                                    <div className="truncate font-semibold text-foreground">
                                                      {group.title || "未設定ライブ"}
                                                    </div>
                                                    <p className="truncate text-sm text-muted-foreground">
                                                      {group.description || "ライブの説明はまだ未設定です。"}
                                                    </p>
                                                  </div>
                                                  <Badge variant="outline">{group.links.length} videos</Badge>
                                                </div>
                                              </CollapsibleTrigger>
                                              <CollapsibleContent className="px-0 pb-0">
                                            <div className="mt-3 rounded-2xl border border-border/75 bg-card/90 p-4">
                                              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                                <div className="text-sm font-medium text-foreground">
                                                  ライブ {groupIndex + 1}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                  <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => moveGroup(sectionIndex, groupIndex, "up")}
                                                    disabled={groupIndex === 0}
                                                  >
                                                    <ChevronUp className="h-4 w-4" />
                                                  </Button>
                                                  <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => moveGroup(sectionIndex, groupIndex, "down")}
                                                    disabled={groupIndex === section.groups.length - 1}
                                                  >
                                                    <ChevronDown className="h-4 w-4" />
                                                  </Button>
                                                  <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => addGroupLink(sectionIndex, groupIndex)}
                                                    className="gap-2"
                                                  >
                                                    <Plus className="h-4 w-4" />
                                                    動画追加
                                                  </Button>
                                                  <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => removeGroup(sectionIndex, groupIndex)}
                                                    className="gap-2"
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                    ライブ削除
                                                  </Button>
                                                </div>
                                              </div>

                                              <div className="grid gap-4 lg:grid-cols-2">
                                                <label className="space-y-2">
                                                  <span className="text-sm font-medium text-foreground">ライブ名</span>
                                                  <Input
                                                    value={group.title}
                                                    onChange={(event) =>
                                                      updateGroupField(sectionIndex, groupIndex, "title", event.target.value)
                                                    }
                                                    placeholder="例: 春ライブ"
                                                  />
                                                </label>
                                                <label className="space-y-2 lg:col-span-2">
                                                  <span className="text-sm font-medium text-foreground">説明</span>
                                                  <Textarea
                                                    value={group.description}
                                                    onChange={(event) =>
                                                      updateGroupField(sectionIndex, groupIndex, "description", event.target.value)
                                                    }
                                                    placeholder="ライブの説明"
                                                    className="min-h-[84px]"
                                                  />
                                                </label>
                                              </div>

                                              <div className="mt-4">
                                                {renderLinkEditorList(
                                                  group.links,
                                                  () => addGroupLink(sectionIndex, groupIndex),
                                                  (linkIndex, field, value) =>
                                                    updateGroupLinkField(
                                                      sectionIndex,
                                                      groupIndex,
                                                      linkIndex,
                                                      field,
                                                      value
                                                    ),
                                                  (linkIndex) => removeGroupLink(sectionIndex, groupIndex, linkIndex),
                                                  (linkIndex, direction) =>
                                                    moveGroupLink(sectionIndex, groupIndex, linkIndex, direction),
                                                  "動画"
                                                )}
                                              </div>
                                            </div>
                                              </CollapsibleContent>
                                            </Collapsible>
                                          );
                                          })}
                                        </div>
                                      )
                                    ) : (
                                      renderLinkEditorList(
                                        section.links,
                                        () => addLink(sectionIndex),
                                        (linkIndex, field, value) =>
                                          updateLinkField(sectionIndex, linkIndex, field, value),
                                        (linkIndex) => removeLink(sectionIndex, linkIndex),
                                        (linkIndex, direction) => moveLink(sectionIndex, linkIndex, direction),
                                        "リンク"
                                      )
                                    )}
                                  </div>
                                </CollapsibleContent>
                              </Card>
                            </Collapsible>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {visibleContent.sections.length === 0 ? (
                <Card className="border-border/80 bg-card/70">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    表示中のセクションはまだありません。
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-5 xl:grid-cols-3">
                  {visibleContent.sections.map((section, index) => {
                    const SectionIcon = getSectionIconComponent(section.icon);
                    const sectionToneClass = sectionToneClasses[index % sectionToneClasses.length];

                    return (
                      <Card key={section.id} className="border-border/80 bg-card/70 backdrop-blur-sm">
                        <CardHeader className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                                sectionToneClass
                              )}
                            >
                              <SectionIcon className="h-5 w-5" />
                            </div>
                            <div className="space-y-1">
                              <CardTitle className="text-lg">{section.title || "未設定セクション"}</CardTitle>
                              <CardDescription>
                                {section.description || "セクション説明はまだ設定されていません。"}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {section.layout === "groups" ? (
                            section.groups.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-border/75 px-4 py-6 text-sm text-muted-foreground">
                                まだライブグループがありません。
                              </div>
                            ) : (
                              section.groups.map((group) => {
                                const groupKey = getGroupAccordionKey(section.id, group.id);

                                return (
                                  <Collapsible
                                    key={group.id}
                                    open={openDisplayGroupKey === groupKey}
                                    onOpenChange={(open) => setOpenDisplayGroupKey(open ? groupKey : null)}
                                  >
                                    <div className="rounded-2xl border border-border/70 bg-background/70">
                                      <CollapsibleTrigger className="rounded-2xl px-4 py-4 shadow-none hover:bg-surface-hover/50">
                                        <div className="flex w-full items-start justify-between gap-3">
                                          <div className="min-w-0 space-y-1 text-left">
                                            <div className="flex items-center gap-2">
                                              <Badge variant="outline">Live</Badge>
                                              <h3 className="truncate font-semibold text-foreground">
                                                {group.title || "Untitled Live"}
                                              </h3>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                              {group.description || `${group.links.length} videos`}
                                            </p>
                                          </div>
                                          <Badge variant="secondary">{group.links.length}</Badge>
                                        </div>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent className="px-4 pb-4">
                                        <div className="space-y-3 border-t border-border/60 pt-4">
                                  <div className="hidden space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline">Live</Badge>
                                      <h3 className="font-semibold text-foreground">{group.title || "未設定ライブ"}</h3>
                                    </div>
                                    {group.description && (
                                      <p className="text-sm text-muted-foreground">{group.description}</p>
                                    )}
                                  </div>
                                  {group.links.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                                      まだ動画リンクがありません。
                                    </div>
                                  ) : (
                                    group.links.map((link) => (
                                      <LinkCard
                                        key={link.id}
                                        href={link.href}
                                        title={link.title}
                                        description={link.description}
                                        badge={link.badge}
                                        badgeVariant={link.badgeVariant}
                                        note={link.note}
                                        sectionIcon={SectionIcon}
                                      />
                                    ))
                                          )}
                                        </div>
                                      </CollapsibleContent>
                                    </div>
                                  </Collapsible>
                                );
                              })
                            )
                          ) : section.links.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border/75 px-4 py-6 text-sm text-muted-foreground">
                              このセクションにはまだリンクがありません。
                            </div>
                          ) : (
                            section.links.map((link) => (
                              <LinkCard
                                key={link.id}
                                href={link.href}
                                title={link.title}
                                description={link.description}
                                badge={link.badge}
                                badgeVariant={link.badgeVariant}
                                note={link.note}
                                sectionIcon={SectionIcon}
                              />
                            ))
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
