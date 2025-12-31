"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";

type AssignmentRow = {
  id: string;
  role: "pa" | "light";
  is_fixed: boolean;
  note: string | null;
  event_slots: {
    id: string;
    event_id: string;
    slot_type: "band" | "break" | "mc" | "other";
    order_in_event: number | null;
    start_time: string | null;
    end_time: string | null;
    note: string | null;
    bands: { name: string | null } | null;
    events: { name: string; date: string } | null;
  } | null;
};

const roleLabel = (role: AssignmentRow["role"]) => (role === "pa" ? "PA" : "照明");

const slotLabel = (slot: AssignmentRow["event_slots"]) => {
  if (!slot) return "不明なスロット";
  if (slot.slot_type === "band") return slot.bands?.name ?? "バンド未設定";
  if (slot.slot_type === "break") return "休憩";
  if (slot.slot_type === "mc") return "MC";
  return slot.note?.trim() || "その他";
};

const timeLabel = (start: string | null, end: string | null) => {
  if (!start && !end) return "時間未設定";
  if (start && end) return `${start} - ${end}`;
  return start ?? end ?? "時間未設定";
};

export default function MyTasksPage() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("slot_staff_assignments")
        .select(
          "id, role, is_fixed, note, event_slots(id, event_id, slot_type, order_in_event, start_time, end_time, note, bands(name), events(name, date))"
        )
        .eq("profile_id", userId);

      if (cancelled) return;

      if (error) {
        console.error(error);
        setError("シフトの取得に失敗しました。");
        setAssignments([]);
      } else {
        setAssignments((data ?? []) as AssignmentRow[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
    setError(null);
  }, [error]);

  const groupedAssignments = useMemo(() => {
    const map = new Map<
      string,
      { eventId: string; eventName: string; eventDate: string | null; items: AssignmentRow[] }
    >();

    assignments.forEach((assignment) => {
      const slot = assignment.event_slots;
      if (!slot?.event_id) return;
      const eventId = slot.event_id;
      const eventName = slot.events?.name ?? "イベント名未設定";
      const eventDate = slot.events?.date ?? null;
      const entry = map.get(eventId) ?? { eventId, eventName, eventDate, items: [] };
      entry.items.push(assignment);
      map.set(eventId, entry);
    });

    return Array.from(map.values()).sort((a, b) => {
      if (!a.eventDate && !b.eventDate) return a.eventName.localeCompare(b.eventName, "ja");
      if (!a.eventDate) return 1;
      if (!b.eventDate) return -1;
      return a.eventDate.localeCompare(b.eventDate);
    });
  }, [assignments]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl pt-12 md:pt-0">
                <Link
                  href="/me/profile"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">マイページ</span>
                </Link>

                <span className="text-xs text-primary tracking-[0.3em] font-mono">MY SHIFTS</span>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 mb-2">担当シフト</h1>
                <p className="text-muted-foreground text-sm md:text-base">
                  参加イベントごとの担当シフトを一覧で確認できます。
                </p>
              </div>
            </div>
          </section>

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl mx-auto space-y-6">
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 animate-spin" />
                    読み込み中です...
                  </div>
                ) : groupedAssignments.length === 0 ? (
                  <Card className="bg-card/60 border-border">
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                      現在の担当シフトはありません。
                    </CardContent>
                  </Card>
                ) : (
                  groupedAssignments.map((group) => {
                    const ordered = [...group.items].sort((a, b) => {
                      const slotA = a.event_slots;
                      const slotB = b.event_slots;
                      const orderA = slotA?.order_in_event ?? Number.MAX_SAFE_INTEGER;
                      const orderB = slotB?.order_in_event ?? Number.MAX_SAFE_INTEGER;
                      if (orderA !== orderB) return orderA - orderB;
                      return (slotA?.start_time ?? "").localeCompare(slotB?.start_time ?? "");
                    });

                    return (
                      <Card key={group.eventId} className="bg-card/60 border-border">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {group.eventName}
                          </CardTitle>
                          <CardDescription>
                            {group.eventDate ? `${group.eventDate} 開催` : "開催日未設定"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {ordered.map((assignment) => {
                            const slot = assignment.event_slots;
                            return (
                              <div
                                key={assignment.id}
                                className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 md:flex-row md:items-center md:justify-between"
                              >
                                <div className="space-y-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">{roleLabel(assignment.role)}</Badge>
                                    {assignment.is_fixed && (
                                      <Badge variant="secondary">固定</Badge>
                                    )}
                                    <p className="text-sm font-medium truncate">
                                      {slotLabel(slot)}
                                    </p>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {slot?.slot_type?.toUpperCase() ?? "-"} / {timeLabel(slot?.start_time ?? null, slot?.end_time ?? null)}
                                  </p>
                                  {slot?.note && (
                                    <p className="text-xs text-muted-foreground">
                                      {slot.note}
                                    </p>
                                  )}
                                  {assignment.note && (
                                    <p className="text-xs text-muted-foreground">
                                      {assignment.note}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
