"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StagePlotPreview } from "@/components/StagePlotPreview";
import { useRepertoireData } from "@/app/events/[id]/repertoire/submit/hooks/useRepertoireData";
import { useRepertoireSave } from "@/app/events/[id]/repertoire/submit/hooks/useRepertoireSave";
import { useMetadata } from "@/app/events/[id]/repertoire/submit/hooks/useMetadata";
import { BandInfoForm } from "@/app/events/[id]/repertoire/submit/components/BandInfoForm";
import { MemberManager } from "@/app/events/[id]/repertoire/submit/components/MemberManager";
import { SetlistEditor } from "@/app/events/[id]/repertoire/submit/components/SetlistEditor";
import { StagePlotEditor } from "@/app/events/[id]/repertoire/submit/components/StagePlotEditor";
import {
  EntryType,
  SongEntry,
  formatDuration,
  formatLightingChoice,
  orderEntries,
  toDurationInputs,
  toDurationSec,
} from "@/app/events/[id]/repertoire/submit/types";

type Props = {
  eventId: string;
  selectedBandId?: string | null;
  hideBandList?: boolean;
  onBandSelect?: (bandId: string) => void;
  readOnly?: boolean;
};

const formatLightingSummary = (entry: SongEntry) => {
  const parts: string[] = [];
  if (entry.lightingSpot) parts.push(`SP:${formatLightingChoice(entry.lightingSpot)}`);
  if (entry.lightingStrobe) parts.push(`ST:${formatLightingChoice(entry.lightingStrobe)}`);
  if (entry.lightingMoving) parts.push(`MV:${formatLightingChoice(entry.lightingMoving)}`);
  const color = entry.lightingColor?.trim();
  if (color) parts.push(`色:${color}`);
  return parts.length > 0 ? parts.join(" / ") : "-";
};

const getDurationText = (entry: SongEntry) => {
  const durationSec = toDurationSec(entry.durationMin, entry.durationSec);
  return formatDuration(durationSec);
};

export function RepertoireSection({
  eventId,
  selectedBandId: externalBandId,
  hideBandList = false,
  onBandSelect,
  readOnly = false,
}: Props) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [viewTab, setViewTab] = useState<"preview" | "edit">("preview");

  const {
    loading,
    error,
    event,
    band,
    availableBands,
    selectedBandId,
    songs,
    stageMembers,
    stageItems,
    profiles,
    myProfileId,
    repertoireStatus,
    lastSavedAt,
    setSongs,
    setStageMembers,
    setStageItems,
    setBand,
    setSelectedBandId,
    refreshData,
  } = useRepertoireData(eventId, userId, {
    adminMode: true,
    initialBandId: externalBandId ?? null,
  });

  const { saving, saveRepertoire } = useRepertoireSave({
    eventId,
    band,
    songs,
    stageMembers,
    stageItems,
    setBand,
    refreshData,
    submitDeadline: event?.repertoire_deadline ?? null,
    canBypassDeadline: true,
    submitClosed: Boolean(event?.repertoire_is_closed),
    canBypassClose: true,
  });

  const { fetchMetadata } = useMetadata();

  useEffect(() => {
    if (!readOnly) return;
    if (viewTab !== "preview") {
      setViewTab("preview");
    }
  }, [readOnly, viewTab]);

  useEffect(() => {
    if (!externalBandId) return;
    if (externalBandId !== selectedBandId) {
      setSelectedBandId(externalBandId);
    }
  }, [externalBandId, selectedBandId, setSelectedBandId]);

  const orderedSongs = useMemo(() => orderEntries(songs), [songs]);

  const memberDetails = useMemo(() => {
    return [...stageMembers]
      .map((member, index) => ({
        id: member.id,
        name: member.realName ?? member.name ?? "未登録",
        instrument: member.instrument || member.part || "-",
        monitorRequest: member.monitorRequest || "-",
        monitorNote: member.monitorNote || "-",
        isMc: member.isMc,
        orderIndex: member.orderIndex ?? index + 1,
      }))
      .sort((a, b) => (a.orderIndex ?? Infinity) - (b.orderIndex ?? Infinity));
  }, [stageMembers]);

  const handleMetadataSchedule = (id: string, url: string, entryType: EntryType) => {
    fetchMetadata(id, url, (targetId, updates) => {
      setSongs((prev) =>
        prev.map((song) => {
          if (song.id !== targetId) return song;

          const next = { ...song };
          if (updates.title) next.title = updates.title;
          if (updates.artist) next.artist = updates.artist;

          if (typeof updates.duration_sec === "number") {
            const { durationMin, durationSec } = toDurationInputs(updates.duration_sec);
            next.durationMin = durationMin;
            next.durationSec = durationSec;
          }
          return next;
        })
      );
    });
  };

  const handleBandChange = (key: any, value: any) => {
    setBand((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const showBandList = !readOnly && !hideBandList;
  const showBandSelector = !readOnly && availableBands.length > 1 && (!hideBandList || viewTab === "edit");

  const handleSelectBand = (bandId: string) => {
    setSelectedBandId(bandId);
    onBandSelect?.(bandId);
  };

  if (!userId) {
    return (
      <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card/60 px-4 py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!band) {
    return (
      <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
        バンドが登録されていません。
      </div>
    );
  }

  const previewContent = (
    <div className="space-y-3">
      <div className="aspect-[2/1] rounded-lg border border-border bg-card/60 p-2">
        <StagePlotPreview items={stageItems} members={stageMembers} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="min-w-0 rounded border border-border bg-card/60 p-2">
          <div className="mb-0.5 text-[10px] font-medium">共通</div>
          <div className="line-clamp-2 break-words text-[10px] text-muted-foreground">
            {band.general_note || "-"}
          </div>
        </div>
        <div className="min-w-0 rounded border border-border bg-card/60 p-2">
          <div className="mb-0.5 text-[10px] font-medium">PA</div>
          <div className="line-clamp-2 break-words text-[10px] text-muted-foreground">
            {band.sound_note || "-"}
          </div>
        </div>
        <div className="min-w-0 rounded border border-border bg-card/60 p-2">
          <div className="mb-0.5 text-[10px] font-medium">照明</div>
          <div className="line-clamp-2 break-words text-[10px] text-muted-foreground">
            {band.lighting_note || "-"}
            {band.lighting_total_min != null && ` (${band.lighting_total_min}分)`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-lg border border-border bg-card/60 p-2">
          <div className="mb-1 text-[10px] font-medium">メンバー ({memberDetails.length})</div>
          <div className="max-h-28 overflow-y-auto overflow-x-hidden">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 bg-card/60 text-[9px] text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-0.5 text-left">パート</th>
                  <th className="py-0.5 text-left">名前</th>
                  <th className="w-6 py-0.5 text-left">MC</th>
                  <th className="py-0.5 text-left">返し要望</th>
                  <th className="py-0.5 text-left">備考</th>
                </tr>
              </thead>
              <tbody>
                {memberDetails.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-1 text-muted-foreground">
                      メンバーが登録されていません。
                    </td>
                  </tr>
                ) : (
                  memberDetails.map((member) => (
                    <tr key={member.id} className="border-b border-border/50">
                      <td className="max-w-12 truncate py-0.5 text-muted-foreground">
                        {member.instrument}
                      </td>
                      <td className="max-w-16 truncate py-0.5">{member.name}</td>
                      <td className="py-0.5">{member.isMc ? "○" : ""}</td>
                      <td className="max-w-16 truncate py-0.5 text-muted-foreground">
                        {member.monitorRequest}
                      </td>
                      <td className="max-w-16 truncate py-0.5 text-muted-foreground">
                        {member.monitorNote}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-border bg-card/60 p-2">
          <div className="mb-1 text-[10px] font-medium">セットリスト ({orderedSongs.length})</div>
          <div className="max-h-28 overflow-y-auto overflow-x-hidden">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 bg-card/60 text-[9px] text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="w-4 py-0.5 text-left">#</th>
                  <th className="py-0.5 text-left">曲名</th>
                  <th className="w-10 py-0.5 text-left">時間</th>
                </tr>
              </thead>
              <tbody>
                {orderedSongs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-1 text-muted-foreground">
                      セットリストが登録されていません。
                    </td>
                  </tr>
                ) : (
                  orderedSongs.map((song, index) => (
                    <tr key={song.id} className="border-b border-border/50">
                      <td className="py-0.5 text-muted-foreground">{index + 1}</td>
                      <td className="py-0.5">
                        <div className="truncate">
                          {song.entry_type === "mc" ? (
                            <span className="text-muted-foreground">MC</span>
                          ) : (
                            <>
                              {song.title || "未入力"}
                              {song.url && (
                                <Link
                                  href={song.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="ml-0.5 text-primary"
                                >
                                  <ExternalLink className="inline h-2 w-2" />
                                </Link>
                              )}
                            </>
                          )}
                        </div>
                        <div className="line-clamp-1 text-[9px] text-muted-foreground">
                          PA: {song.memo || "-"}
                        </div>
                        <div className="line-clamp-1 text-[9px] text-muted-foreground">
                          照明: {formatLightingSummary(song)}
                        </div>
                      </td>
                      <td className="py-0.5 text-muted-foreground">{getDurationText(song)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 overflow-hidden">
      {showBandList && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {availableBands.map((entry) => (
            <button
              key={entry.id}
              onClick={() => handleSelectBand(entry.id)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs transition-colors ${
                entry.id === selectedBandId
                  ? "bg-accent text-accent-foreground"
                  : "border border-border bg-card/60 hover:bg-accent/50"
              }`}
            >
              <div className="font-medium">{entry.name}</div>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold truncate">{band.name}</h3>
        <Badge variant={repertoireStatus === "submitted" ? "default" : "secondary"} className="text-[10px]">
          {repertoireStatus === "submitted" ? "提出済み" : "下書き"}
        </Badge>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span>代表: {band.representative_name || "未設定"}</span>
          {!readOnly && (
            <Link
              href={`/events/${eventId}/repertoire/submit?bandId=${band.id}`}
              className="flex items-center gap-1 text-primary hover:underline"
            >
              レパ表を別画面で開く
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      {readOnly ? (
        previewContent
      ) : (
        <Tabs
          value={viewTab}
          onValueChange={(value) => setViewTab(value as "preview" | "edit")}
          className="space-y-3"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">プレビュー</TabsTrigger>
            <TabsTrigger value="edit">編集</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="space-y-3">
            {previewContent}
          </TabsContent>

          <TabsContent value="edit" className="space-y-4">
            {showBandSelector && (
              <div className="rounded-lg border border-border bg-card/60 p-3">
                <div className="text-xs font-medium text-foreground">編集するバンド</div>
                <div className="mt-2 max-w-xs">
                  <Select
                    value={selectedBandId ?? ""}
                    onValueChange={(value) => handleSelectBand(value)}
                    options={availableBands.map((entry) => ({
                      value: entry.id,
                      label: entry.name,
                    }))}
                    placeholder="バンドを選択"
                    aria-label="編集するバンド"
                  />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  右側プレビューは選択中のバンド内容を表示します。
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 p-3">
              <div className="text-xs text-muted-foreground">
                ステータス:{" "}
                <span className="font-medium text-foreground">
                  {repertoireStatus === "submitted" ? "提出済み" : "下書き"}
                </span>
              </div>
              {lastSavedAt && (
                <div className="text-xs text-muted-foreground">最終保存: {lastSavedAt}</div>
              )}
              <div className="ml-auto flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => saveRepertoire("draft")} disabled={saving}>
                  保存
                </Button>
                <Button size="sm" onClick={() => saveRepertoire("submitted")} disabled={saving}>
                  提出
                </Button>
              </div>
            </div>

            <Tabs defaultValue="info" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
                <TabsTrigger value="info">基本情報</TabsTrigger>
                <TabsTrigger value="members">メンバー</TabsTrigger>
                <TabsTrigger value="setlist">セットリスト</TabsTrigger>
                <TabsTrigger value="stageplot">配置図</TabsTrigger>
              </TabsList>

              <TabsContent value="info">
                <BandInfoForm band={band} onChange={handleBandChange} />
              </TabsContent>

              <TabsContent value="members">
                <MemberManager
                  members={stageMembers}
                  profiles={profiles}
                  myProfileId={myProfileId}
                  setMembers={setStageMembers}
                />
              </TabsContent>

              <TabsContent value="setlist">
                <SetlistEditor songs={songs} setSongs={setSongs} onScheduleMetadata={handleMetadataSchedule} />
              </TabsContent>

              <TabsContent value="stageplot">
                <StagePlotEditor
                  members={stageMembers}
                  items={stageItems}
                  setMembers={setStageMembers}
                  setItems={setStageItems}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
