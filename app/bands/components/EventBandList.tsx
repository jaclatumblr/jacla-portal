"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Plus, Trash2, UserPlus } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { toast } from "@/lib/toast";
import { useBandWriteAccess } from "../hooks/useBandWriteAccess";
import { formatDate } from "../types";
import type { EventBandSummary, EventRow, ProfileRow } from "../types";

type EventBandListProps = {
  events: EventRow[];
  selectedEventId: string;
  onEventChange: (id: string) => void;
  bands: EventBandSummary[];
  eventName: string | null;
  eventDate: string | null;
  selfPart: string;
  subPartsByProfileId: Record<string, string[]>;
  getFilteredProfiles: (existingUserIds: string[], query: string) => ProfileRow[];
  onRefresh: () => Promise<void>;
  showEventSelect?: boolean;
  loading?: boolean;
};

export function EventBandList({
  events,
  selectedEventId,
  onEventChange,
  bands,
  eventName,
  eventDate,
  selfPart,
  subPartsByProfileId,
  getFilteredProfiles,
  onRefresh,
  showEventSelect = true,
  loading = false,
}: EventBandListProps) {
  const { session } = useAuth();
  const { isAdmin } = useRoleFlags();
  const { blocked, reason } = useBandWriteAccess(events.find((event) => event.id === selectedEventId) ?? null);
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const dialogRequest = useRef(0);
  const userId = session?.user.id ?? null;

  const [joinInstruments, setJoinInstruments] = useState<Record<string, string>>({});

  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [activeBand, setActiveBand] = useState<EventBandSummary | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [memberInstrument, setMemberInstrument] = useState("");
  const [existingUserIds, setExistingUserIds] = useState<string[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const filteredProfiles = useMemo(() => {
    if (!activeBand) return [];
    return getFilteredProfiles(existingUserIds, memberSearch);
  }, [activeBand, existingUserIds, memberSearch, getFilteredProfiles]);

  const joinBand = async (bandId: string) => {
    if (!userId) return;
    const instrument = (joinInstruments[bandId] ?? selfPart).trim();
    if (!instrument) {
      toast.error("担当パートを入力してください。");
      return;
    }

    const { error } = await supabase.from("band_members").insert({
      band_id: bandId,
      user_id: userId,
      instrument,
    });

    if (error) {
      console.error(error);
      toast.error("参加登録に失敗しました。");
      return;
    }

    toast.success("バンドに参加しました。");
    await onRefresh();
  };

  const deleteBand = async (band: EventBandSummary) => {
    if (!userId) return;
    const canDelete = band.created_by === userId || isAdmin;
    if (!canDelete) {
      toast.error("削除権限がありません。");
      return;
    }

    const confirmed = window.confirm(`「${band.name}」を削除します。よろしいですか？`);
    if (!confirmed) return;

    const { error } = await supabase.from("bands").delete().eq("id", band.id);
    if (error) {
      console.error(error);
      toast.error("バンドの削除に失敗しました。");
      return;
    }

    toast.success("バンドを削除しました。");
    await onRefresh();
  };

  const openMemberDialog = async (band: EventBandSummary) => {
    const request = ++dialogRequest.current;
    setActiveBand(band);
    setIsMemberDialogOpen(true);
    setMemberSearch("");
    setSelectedProfileId("");
    setMemberInstrument("");
    setExistingUserIds([]);
    setLoadingMembers(true);

    try {
      const { data, error } = await supabase
        .from("band_members")
        .select("user_id")
        .eq("band_id", band.id);

      if (request !== dialogRequest.current) return;
      if (error) throw error;
      const ids = (data ?? [])
        .map((row) => (row as { user_id?: string | null }).user_id)
        .filter((id): id is string => Boolean(id));
      setExistingUserIds(ids);
    } catch (error) {
      if (request !== dialogRequest.current) return;
      console.error(error);
      toast.error("メンバーの取得に失敗しました。");
      setIsMemberDialogOpen(false);
      setActiveBand(null);
    } finally {
      if (request === dialogRequest.current) setLoadingMembers(false);
    }
  };

  const handleSelectProfile = (profile: ProfileRow) => {
    setSelectedProfileId(profile.id);
    const fallback = profile.part ?? (subPartsByProfileId[profile.id] ?? [])[0] ?? "";
    setMemberInstrument(fallback);
  };

  const addMember = async () => {
    if (!activeBand) return;
    if (!selectedProfileId) {
      toast.error("追加するメンバーを選択してください。");
      return;
    }
    const instrument = memberInstrument.trim();
    if (!instrument) {
      toast.error("担当パートを入力してください。");
      return;
    }

    const { error } = await supabase.from("band_members").insert({
      band_id: activeBand.id,
      user_id: selectedProfileId,
      instrument,
      order_index: existingUserIds.length + 1,
    });

    if (error) {
      console.error(error);
      toast.error("メンバーの追加に失敗しました。");
      return;
    }

    toast.success("メンバーを追加しました。");
    setIsMemberDialogOpen(false);
    setSelectedProfileId("");
    setMemberInstrument("");
    await onRefresh();
  };

  const mutate = async (action: () => Promise<void>) => {
    if (blocked || loading || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try { await action(); } catch (error) {
      console.error(error);
      toast.error("処理に失敗しました。一覧を更新して確認してください。");
    } finally { inFlight.current = false; setPending(false); }
  };

  return (
    <Card className="bg-card/60" aria-busy={loading}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">イベントバンド一覧</CardTitle>
        {showEventSelect && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">イベント</label>
            <select
              value={selectedEventId}
              onChange={(e) => onEventChange(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              {events.length === 0 && <option value="">イベントがありません</option>}
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} {event.date ? `(${formatDate(event.date)})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        {eventName && (
          <p className="text-xs text-muted-foreground">
            {showEventSelect ? "選択中: " : ""}
            {eventName} {eventDate && `(${eventDate})`}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {reason && <p role="status" className="text-sm text-muted-foreground">{reason}</p>}
        {bands.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {loading ? "バンド一覧を読み込んでいます..." : "このイベントにはまだバンドがありません。"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {!loading && "作成フォームから新しいバンドを作成してください。"}
            </p>
          </div>
        ) : (
          bands.map((band) => {
            const isOwner = band.created_by === userId;
            const canDelete = isOwner || isAdmin;
            const canManage = isOwner || isAdmin;
            const memberPreview = band.memberNames.slice(0, 4);
            const extraMembers = band.memberNames.length - memberPreview.length;

            return (
              <div
                key={band.id}
                className="rounded-lg border border-border bg-background/50 p-3 md:p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{band.name}</p>
                      {band.isMember && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                          参加中
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>メンバー {band.members}人</span>
                      {memberPreview.map((name, index) => (
                        <span
                          key={`${band.id}-member-${index}`}
                          className="rounded-full bg-muted/40 px-2 py-0.5 text-[11px] text-foreground/80"
                        >
                          {name}
                        </span>
                      ))}
                      {extraMembers > 0 && (
                        <span className="text-[11px] text-muted-foreground">+{extraMembers}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!band.isMember && (
                      <>
                        <Input
                          value={joinInstruments[band.id] ?? selfPart}
                          onChange={(e) =>
                            setJoinInstruments((prev) => ({
                              ...prev,
                              [band.id]: e.target.value,
                            }))
                          }
                          placeholder="担当パート"
                          className="h-8 w-32 text-sm"
                        />
                        <Button size="sm" disabled={blocked || pending || loading} onClick={() => void mutate(() => joinBand(band.id))} className="h-8">
                          {pending ? "処理中..." : "参加する"}
                        </Button>
                      </>
                    )}
                    {canManage && (
                      <Dialog
                        open={isMemberDialogOpen && activeBand?.id === band.id}
                        onOpenChange={(open) => {
                          if (!open) {
                            dialogRequest.current += 1;
                            setIsMemberDialogOpen(false);
                            setActiveBand(null);
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            disabled={blocked || pending || loading} onClick={() => void openMemberDialog(band)}
                          >
                            <UserPlus className="mr-1 h-4 w-4" />
                            メンバー追加
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>メンバーを追加</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <Input
                              placeholder="名前・パートで検索"
                              value={memberSearch}
                              onChange={(e) => setMemberSearch(e.target.value)}
                              className="h-9"
                            />

                            <div className="max-h-[260px] overflow-y-auto rounded-lg border border-border">
                              {loadingMembers ? (
                                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  読み込み中...
                                </div>
                              ) : filteredProfiles.length === 0 ? (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                  該当するメンバーがいません
                                </div>
                              ) : (
                                <div className="divide-y divide-border">
                                  {filteredProfiles.map((profile) => (
                                    <button
                                      key={profile.id}
                                      type="button"
                                      onClick={() => handleSelectProfile(profile)}
                                      className={`w-full px-3 py-2 text-left hover:bg-muted ${
                                        selectedProfileId === profile.id ? "bg-primary/10" : ""
                                      }`}
                                    >
                                      <div className="text-sm font-medium">
                                        {profile.display_name || profile.real_name || "未設定"}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {profile.part ?? "未設定"}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-end gap-2">
                              <div className="flex-1 space-y-1.5">
                                <label className="text-sm font-medium">担当パート</label>
                                <Input
                                  value={memberInstrument}
                                  onChange={(e) => setMemberInstrument(e.target.value)}
                                  placeholder="例: Gt., Vo."
                                  className="h-9"
                                />
                              </div>
                              <Button onClick={() => void mutate(addMember)} className="h-9" disabled={!selectedProfileId || blocked || pending || loading || loadingMembers}>
                                <Plus className="mr-1 h-4 w-4" />
                                {pending ? "追加中..." : "追加"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={blocked || pending || loading} onClick={() => void mutate(() => deleteBand(band))}
                        aria-label={`${band.name}を削除`}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
