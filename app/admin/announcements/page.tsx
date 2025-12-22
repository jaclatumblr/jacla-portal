"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const categoryOptions = ["重要", "イベント", "締切", "機材", "事務", "お知らせ"];

type AnnouncementAuthor = {
  display_name: string | null;
};

type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  category: string;
  is_published: boolean;
  published_at: string | null;
  is_pinned: boolean;
  image_url: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
  author_id: string | null;
  profiles?: AnnouncementAuthor | null;
};

type AnnouncementRowResponse = Omit<AnnouncementRow, "profiles"> & {
  profiles?: AnnouncementAuthor[] | AnnouncementAuthor | null;
};

const imageTypes = ["image/png", "image/jpeg", "image/webp"];
const maxImageSizeMb = 5;

const normalizeAnnouncementRow = (row: AnnouncementRowResponse): AnnouncementRow => {
  const profileValue = Array.isArray(row.profiles)
    ? row.profiles[0] ?? null
    : row.profiles ?? null;
  return { ...row, profiles: profileValue };
};

export default function AdminAnnouncementsPage() {
  const { session } = useAuth();
  const { canAccessAdmin, loading: roleLoading } = useRoleFlags();

  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("お知らせ");
  const [isPublished, setIsPublished] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageRemove, setImageRemove] = useState(false);

  const selectedAnnouncement = useMemo(
    () => announcements.find((item) => item.id === selectedId) ?? null,
    [announcements, selectedId]
  );

  const filteredAnnouncements = useMemo(() => {
    const query = search.trim().toLowerCase();
    return announcements.filter((item) => {
      if (statusFilter === "published" && !item.is_published) return false;
      if (statusFilter === "draft" && item.is_published) return false;
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query)
      );
    });
  }, [announcements, search, statusFilter]);

  useEffect(() => {
    if (roleLoading || !canAccessAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("announcements")
        .select(
          "id, title, content, category, is_published, published_at, is_pinned, image_url, attachment_url, created_at, updated_at, author_id, profiles:author_id(display_name)"
        )
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error(error);
        setError("お知らせの取得に失敗しました。");
        setAnnouncements([]);
      } else {
        const rows = (data ?? []) as AnnouncementRowResponse[];
        setAnnouncements(rows.map(normalizeAnnouncementRow));
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [roleLoading, canAccessAdmin]);

  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  const resetForm = () => {
    setSelectedId(null);
    setTitle("");
    setContent("");
    setCategory("お知らせ");
    setIsPublished(false);
    setIsPinned(false);
    setAttachmentUrl("");
    setImageUrl(null);
    setImagePreview(null);
    setImageFile(null);
    setImageRemove(false);
    setImageError(null);
  };

  const loadForm = (row: AnnouncementRow) => {
    setSelectedId(row.id);
    setTitle(row.title);
    setContent(row.content);
    setCategory(row.category);
    setIsPublished(row.is_published);
    setIsPinned(row.is_pinned);
    setAttachmentUrl(row.attachment_url ?? "");
    setImageUrl(row.image_url ?? null);
    setImagePreview(row.image_url ?? null);
    setImageFile(null);
    setImageRemove(false);
    setImageError(null);
  };

  const handleFileChange = (file: File | null) => {
    setImageError(null);
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!imageTypes.includes(file.type)) {
      setImageError("PNG/JPG/WEBP の画像を選択してください。");
      return;
    }
    if (file.size > maxImageSizeMb * 1024 * 1024) {
      setImageError(`画像サイズは ${maxImageSizeMb}MB 以下にしてください。`);
      return;
    }
    setImageFile(file);
    setImageRemove(false);
  };

  const handleSave = async () => {
    if (!session) return;
    if (!title.trim()) {
      setError("タイトルを入力してください。");
      return;
    }
    if (!content.trim()) {
      setError("本文を入力してください。");
      return;
    }
    if (!categoryOptions.includes(category)) {
      setError("カテゴリを選択してください。");
      return;
    }
    setSaving(true);
    setError(null);

    const publishedAt =
      isPublished && selectedAnnouncement?.published_at
        ? selectedAnnouncement.published_at
        : isPublished
          ? new Date().toISOString()
          : null;

    const payload = {
      title: title.trim(),
      content: content.trim(),
      category,
      is_published: isPublished,
      is_pinned: isPinned,
      attachment_url: attachmentUrl.trim() || null,
      author_id: session.user.id,
      published_at: publishedAt,
    };

    let targetId = selectedId;
    if (selectedId) {
      const { error } = await supabase
        .from("announcements")
        .update(payload)
        .eq("id", selectedId);
      if (error) {
        console.error(error);
        setError("保存に失敗しました。");
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("announcements")
        .insert(payload)
        .select(
          "id, title, content, category, is_published, published_at, is_pinned, image_url, attachment_url, created_at, updated_at, author_id, profiles:author_id(display_name)"
        )
        .maybeSingle();
      if (error || !data) {
        console.error(error);
        setError("作成に失敗しました。");
        setSaving(false);
        return;
      }
      const created = normalizeAnnouncementRow(data as AnnouncementRowResponse);
      targetId = created.id;
      setSelectedId(targetId);
      setAnnouncements((prev) => [created, ...prev]);
    }

    let nextImageUrl = imageUrl;
    if (imageFile && targetId) {
      const fileExt = imageFile.name.split(".").pop() ?? "png";
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `announcements/${targetId}/${Date.now()}-${safeName || `image.${fileExt}`}`;
      const { error: uploadError } = await supabase.storage
        .from("announcement-images")
        .upload(path, imageFile, { upsert: true });
      if (uploadError) {
        console.error(uploadError);
        setError("画像のアップロードに失敗しました。");
        setSaving(false);
        return;
      }
      const { data: publicUrl } = supabase.storage
        .from("announcement-images")
        .getPublicUrl(path);
      nextImageUrl = publicUrl.publicUrl;
    }

    if (imageRemove && !imageFile) {
      nextImageUrl = null;
    }

    if ((imageFile || imageRemove) && targetId) {
      const { error: imageUpdateError } = await supabase
        .from("announcements")
        .update({ image_url: nextImageUrl })
        .eq("id", targetId);
      if (imageUpdateError) {
        console.error(imageUpdateError);
        setError("画像の保存に失敗しました。");
        setSaving(false);
        return;
      }
      setImageUrl(nextImageUrl);
      setImagePreview(nextImageUrl);
      setImageFile(null);
      setImageRemove(false);
    }

    const { data: refreshed, error: refreshError } = await supabase
      .from("announcements")
      .select(
        "id, title, content, category, is_published, published_at, is_pinned, image_url, attachment_url, created_at, updated_at, author_id, profiles:author_id(display_name)"
      )
      .order("created_at", { ascending: false });
    if (!refreshError && refreshed) {
      const rows = (refreshed ?? []) as AnnouncementRowResponse[];
      setAnnouncements(rows.map(normalizeAnnouncementRow));
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const confirmed = window.confirm("このお知らせを削除します。よろしいですか？");
    if (!confirmed) return;
    const confirmedTwice = window.confirm("この操作は取り消せません。本当に削除しますか？");
    if (!confirmedTwice) return;

    setDeleting(true);
    setError(null);
    const { error } = await supabase.from("announcements").delete().eq("id", selectedId);
    if (error) {
      console.error(error);
      setError("削除に失敗しました。");
      setDeleting(false);
      return;
    }
    setAnnouncements((prev) => prev.filter((item) => item.id !== selectedId));
    resetForm();
    setDeleting(false);
  };

  if (roleLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AuthGuard>
    );
  }

  if (!canAccessAdmin) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="text-center space-y-3">
            <p className="text-xl font-semibold text-foreground">管理者のみアクセスできます。</p>
            <p className="text-sm text-muted-foreground">管理者にお問い合わせください。</p>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:border-primary/60 hover:text-primary transition-colors"
            >
              ホームに戻る
            </Link>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <ArrowLeft className="w-4 h-4" />
                <Link href="/admin" className="hover:text-primary transition-colors">
                  管理ダッシュボードに戻る
                </Link>
              </div>
              <div className="max-w-4xl mt-6">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">ADMIN</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-3">お知らせ管理</h1>
                <p className="text-muted-foreground text-sm md:text-base">
                  WordPressのように投稿を管理できます。公開状態・固定表示・カテゴリを調整してください。
                </p>
              </div>
            </div>
          </section>

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-6">
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
                  <RefreshCw className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="grid lg:grid-cols-[1.15fr,1fr] gap-6">
                <Card className="bg-card/60 border-border">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">投稿一覧</CardTitle>
                        <CardDescription>
                          検索・フィルタで対象を絞り込めます。
                        </CardDescription>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetForm}
                        className="whitespace-nowrap"
                      >
                        新規作成
                      </Button>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="タイトル・本文を検索"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      <select
                        value={statusFilter}
                        onChange={(e) =>
                          setStatusFilter(e.target.value as "all" | "published" | "draft")
                        }
                        className="h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                      >
                        <option value="all">すべて</option>
                        <option value="published">公開済み</option>
                        <option value="draft">下書き済み</option>
                      </select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>タイトル</TableHead>
                            <TableHead className="w-24">状態</TableHead>
                            <TableHead className="w-24">カテゴリ</TableHead>
                            <TableHead className="w-32">更新日</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  読み込み中...
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : filteredAnnouncements.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-sm text-muted-foreground">
                                該当する投稿がありません。
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredAnnouncements.map((item) => {
                              const active = item.id === selectedId;
                              const dateValue = item.updated_at ?? item.created_at;
                              const dateLabel = dateValue
                                ? new Date(dateValue).toLocaleDateString("ja-JP")
                                : "";
                              return (
                                <TableRow
                                  key={item.id}
                                  onClick={() => loadForm(item)}
                                  className={cn(
                                    "cursor-pointer",
                                    active ? "bg-primary/10" : "hover:bg-muted/40"
                                  )}
                                >
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      {item.is_pinned && (
                                        <Badge variant="outline" className="text-xs">
                                          固定
                                        </Badge>
                                      )}
                                      <span className="line-clamp-1">{item.title}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={item.is_published ? "default" : "secondary"}>
                                      {item.is_published ? "公開" : "下書き"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{item.category}</Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {dateLabel}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/60 border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">編集</CardTitle>
                    <CardDescription>
                      公開状態・カテゴリ・固定表示を調整できます。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <label className="space-y-1 block text-sm">
                      <span className="text-foreground">タイトル</span>
                      <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                    </label>

                    <label className="space-y-1 block text-sm">
                      <span className="text-foreground">本文</span>
                      <Textarea
                        rows={8}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                      />
                    </label>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">カテゴリ</span>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                        >
                          {categoryOptions.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">公開状態</span>
                        <select
                          value={isPublished ? "published" : "draft"}
                          onChange={(e) => setIsPublished(e.target.value === "published")}
                          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                        >
                          <option value="draft">下書き</option>
                          <option value="published">公開</option>
                        </select>
                      </label>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={isPinned}
                        onChange={(e) => setIsPinned(e.target.checked)}
                      />
                      <span className="text-foreground">固定表示にする</span>
                    </label>

                    <label className="space-y-1 block text-sm">
                      <span className="text-foreground">添付リンク (任意)</span>
                      <Input
                        value={attachmentUrl}
                        onChange={(e) => setAttachmentUrl(e.target.value)}
                        placeholder="Google Drive のリンクなど"
                      />
                    </label>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-foreground">
                        <span>画像 (任意)</span>
                        {imagePreview && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setImageRemove(true);
                              setImageFile(null);
                              setImagePreview(null);
                              setImageUrl(null);
                            }}
                            className="h-8 px-2 text-xs text-muted-foreground"
                          >
                            画像を削除
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-md text-xs text-muted-foreground cursor-pointer hover:border-primary/60">
                          <ImageIcon className="w-4 h-4" />
                          画像を選択
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                            className="hidden"
                          />
                        </label>
                        {imagePreview && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {imageFile ? imageFile.name : "登録済み画像"}
                          </div>
                        )}
                      </div>
                      {imagePreview && (
                        <img
                          src={imagePreview}
                          alt="announcement preview"
                          className="w-full max-h-48 object-cover rounded-md border border-border"
                        />
                      )}
                      {imageError && <p className="text-xs text-destructive">{imageError}</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button onClick={handleSave} disabled={saving} className="gap-2">
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        保存する
                      </Button>
                      {selectedId && (
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={handleDelete}
                          disabled={deleting || saving}
                          className="gap-2"
                        >
                          {deleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          削除する
                        </Button>
                      )}
                      {selectedAnnouncement?.profiles?.display_name && (
                        <span className="text-xs text-muted-foreground">
                          作成者: {selectedAnnouncement.profiles.display_name}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
