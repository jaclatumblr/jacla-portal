"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Calendar, Link as LinkIcon, Pin, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";

type AnnouncementAuthor = {
  display_name: string | null;
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  published_at: string | null;
  created_at: string;
  image_url: string | null;
  attachment_url: string | null;
  profiles?: AnnouncementAuthor | null;
};

type AnnouncementResponse = Omit<Announcement, "profiles"> & {
  profiles?: AnnouncementAuthor[] | AnnouncementAuthor | null;
};

const normalizeAnnouncement = (row: AnnouncementResponse): Announcement => {
  const profileValue = Array.isArray(row.profiles)
    ? row.profiles[0] ?? null
    : row.profiles ?? null;
  return { ...row, profiles: profileValue };
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("ja-JP") : "";

export default function AnnouncementDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);

  const dateValue = useMemo(() => {
    if (!announcement) return null;
    return announcement.published_at ?? announcement.created_at;
  }, [announcement]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("announcements")
        .select(
          "id, title, content, category, is_pinned, published_at, created_at, image_url, attachment_url, profiles:author_id(display_name)"
        )
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        if (error) console.error(error);
        setAnnouncement(null);
      } else {
        setAnnouncement(normalizeAnnouncement(data as AnnouncementResponse));
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-3xl pt-12 md:pt-0">
                <Link
                  href="/announcements"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">お知らせ一覧に戻る</span>
                </Link>

                {loading ? (
                  <p className="text-sm text-muted-foreground">読み込み中...</p>
                ) : !announcement ? (
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
                    お知らせが見つかりません。
                  </h1>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      {announcement.is_pinned && <Pin className="w-4 h-4 text-primary" />}
                      <Badge variant="default">{announcement.category}</Badge>
                    </div>

                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
                      {announcement.title}
                    </h1>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(dateValue)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{announcement.profiles?.display_name ?? "未設定"}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          {announcement && (
            <section className="py-8 md:py-12">
              <div className="container mx-auto px-4 sm:px-6">
                <div className="max-w-3xl mx-auto space-y-6">
                  {announcement.image_url && (
                    <img
                      src={announcement.image_url}
                      alt={announcement.title}
                      className="w-full max-h-[360px] object-cover rounded-lg border border-border"
                    />
                  )}
                  <div className="p-6 md:p-8 bg-card/50 border border-border rounded-lg">
                    <div className="text-sm md:text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {announcement.content}
                    </div>

                    {announcement.attachment_url && (
                      <div className="mt-6">
                        <a
                          href={announcement.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <LinkIcon className="w-4 h-4" />
                          添付リンクを開く
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
