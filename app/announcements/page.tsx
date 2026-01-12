"use client";

import Link from "next/link";
import { ArrowRight, Calendar, Pin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SkeletonAnnouncementCard } from "@/components/ui/skeleton";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";

type Announcement = {
  id: string;
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("ja-JP") : "";

const isRecent = (value: string | null) => {
  if (!value) return false;
  const diff = Date.now() - new Date(value).getTime();
  return diff < 1000 * 60 * 60 * 24 * 7;
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const pinned = useMemo(
    () => announcements.filter((item) => item.is_pinned),
    [announcements]
  );
  const regular = useMemo(
    () => announcements.filter((item) => !item.is_pinned),
    [announcements]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, content, category, is_pinned, is_published, published_at, created_at")
        .eq("is_published", true)
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error(error);
        setAnnouncements([]);
      } else {
        setAnnouncements((data ?? []) as Announcement[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Announcements"
            title="お知らせ"
            description="最新のお知らせを時系列で確認できます。重要・イベント・締切などの情報をまとめています。"
            size="lg"
          />

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
                {loading && (
                  <>
                    {[...Array(4)].map((_, i) => (
                      <SkeletonAnnouncementCard key={i} />
                    ))}
                  </>
                )}

                {!loading && pinned.length === 0 && regular.length === 0 && (
                  <div className="text-sm text-muted-foreground">お知らせがありません。</div>
                )}

                {!loading &&
                  pinned.map((announcement) => {
                    const dateValue = announcement.published_at ?? announcement.created_at;
                    const isNew = isRecent(dateValue);
                    return (
                      <Link
                        key={announcement.id}
                        href={`/announcements/${announcement.id}`}
                        className="group block"
                      >
                        <div className="relative p-4 sm:p-6 bg-primary/5 border border-primary/20 rounded-lg hover:border-primary/50 transition-all duration-300">
                          <div className="absolute top-4 right-4">
                            <Pin className="w-4 h-4 text-primary" />
                          </div>

                          <div className="relative">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <Badge variant="default" className="bg-primary text-primary-foreground">
                                  {announcement.category}
                                </Badge>
                                {isNew && <Badge className="bg-red-500 text-white">NEW</Badge>}
                                <h3 className="text-lg sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                                  {announcement.title}
                                </h3>
                              </div>
                            </div>

                            <p className="text-muted-foreground mb-4 text-sm sm:text-base line-clamp-2">
                              {announcement.content}
                            </p>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="w-4 h-4 text-primary shrink-0" />
                                <span>{formatDate(dateValue)}</span>
                              </div>
                              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}

                {!loading &&
                  regular.map((announcement) => {
                    const dateValue = announcement.published_at ?? announcement.created_at;
                    return (
                      <Link
                        key={announcement.id}
                        href={`/announcements/${announcement.id}`}
                        className="group block"
                      >
                        <div className="relative p-4 sm:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all duration-300">
                          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />

                          <div className="relative">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <Badge variant="outline" className="bg-transparent">
                                  {announcement.category}
                                </Badge>
                                <h3 className="text-lg sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                                  {announcement.title}
                                </h3>
                              </div>
                              <ArrowRight className="hidden sm:block w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                            </div>

                            <p className="text-muted-foreground mb-4 text-sm sm:text-base line-clamp-2">
                              {announcement.content}
                            </p>

                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4 text-primary shrink-0" />
                              <span>{formatDate(dateValue)}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
