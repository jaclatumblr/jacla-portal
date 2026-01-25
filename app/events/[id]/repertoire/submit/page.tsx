"use client";

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useRepertoireData } from "./hooks/useRepertoireData";
import { useRepertoireSave } from "./hooks/useRepertoireSave";
import { useMetadata } from "./hooks/useMetadata";
import { EventHeader } from "./components/EventHeader";
import { BandInfoForm } from "./components/BandInfoForm";
import { MemberManager } from "./components/MemberManager";
import { SetlistEditor } from "./components/SetlistEditor";
import { StagePlotEditor } from "./components/StagePlotEditor";
import { StagePlotPreview } from "@/components/StagePlotPreview";
import { EntryType, SongEntry, toDurationInputs } from "./types";

export default function RepertoireSubmitPage() {
  const params = useParams();
  const eventId = typeof params?.id === "string" ? params.id : "";
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const userId = session?.user.id;
  const initialBandId = searchParams?.get("bandId");

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
    restoreFromDraft,
    clearDraft,
  } = useRepertoireData(eventId, userId, { initialBandId });

  const { saving, saveRepertoire } = useRepertoireSave({
    eventId,
    band,
    songs,
    stageMembers,
    stageItems,
    setBand,
    refreshData,
    submitDeadline: event?.repertoire_deadline ?? null,
    submitClosed: Boolean(event?.repertoire_is_closed),
  });

  const { fetchingMeta, fetchMetadata } = useMetadata();
  const isSubmitted = repertoireStatus === "submitted";
  const isManualClosed = Boolean(event?.repertoire_is_closed);
  const deadlineDate = event?.repertoire_deadline ? new Date(event.repertoire_deadline) : null;
  const validDeadline = deadlineDate && !Number.isNaN(deadlineDate.getTime()) ? deadlineDate : null;
  const deadlineLabel = validDeadline
    ? validDeadline.toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" })
    : null;
  const isDeadlinePassed = validDeadline ? Date.now() > validDeadline.getTime() : false;
  const submitDisabledReason = isManualClosed
    ? "????????????????"
    : isDeadlinePassed
      ? "????????????????????"
      : null;
  const showDeadlineInfo = Boolean(deadlineLabel) || isManualClosed;

  const handleMetadataSchedule = (id: string, url: string, type: EntryType) => {
    fetchMetadata(id, url, (targetId, updates) => {
      setSongs((prev) =>
        prev.map((s) => {
          if (s.id !== targetId) return s;

          const next = { ...s };
          if (updates.title) next.title = updates.title;
          if (updates.artist) next.artist = updates.artist;

          if (typeof updates.duration_sec === 'number') {
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
    setBand((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !event || !band) {
    return (
      <AuthGuard>
        <div className="flex min-h-screen bg-background">
          <SideNav />
          <main className="flex-1 p-8">
            <h1 className="text-xl font-bold text-destructive">エラー</h1>
            <p className="mt-2 text-muted-foreground">{error ?? "データが見つかりません"}</p>
          </main>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <EventHeader
            eventName={event.name}
            bandName={band.name}
            status={repertoireStatus}
            lastSavedAt={lastSavedAt}
            saving={saving}
            onSave={saveRepertoire}
            onReset={() => refreshData()}
            showReset={true}
            submitDisabled={isManualClosed || isDeadlinePassed}
            submitDisabledReason={submitDisabledReason}
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-6">
              {showDeadlineInfo && (
                <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">????</span>
                    <span className="text-sm text-muted-foreground">{deadlineLabel ?? "???"}</span>
                  </div>
                  {isManualClosed && (
                    <p className="mt-2 text-xs text-destructive">????????????????</p>
                  )}
                  {isDeadlinePassed && (
                    <p className="mt-1 text-xs text-destructive">
                      ????????????????????
                    </p>
                  )}
                </div>
              )}
              {availableBands.length > 1 && (
                <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
                  <div className="text-sm font-medium text-foreground">提出するバンド</div>
                  <div className="mt-2 max-w-sm">
                    <Select
                      value={selectedBandId ?? ""}
                      onValueChange={(value) => setSelectedBandId(value)}
                      options={availableBands.map((entry) => ({
                        value: entry.id,
                        label: entry.name,
                      }))}
                      placeholder="バンドを選択"
                      aria-label="提出するバンド"
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    掛け持ちの場合はバンドを切り替えて入力してください。
                  </p>
                </div>
              )}

              <Tabs defaultValue="info" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
                  <TabsTrigger value="info">基本情報</TabsTrigger>
                  <TabsTrigger value="members">メンバー</TabsTrigger>
                  <TabsTrigger value="setlist">セットリスト</TabsTrigger>
                  <TabsTrigger value="stageplot">配置図</TabsTrigger>
                </TabsList>

                <TabsContent value="info">
                  <BandInfoForm band={band} onChange={handleBandChange} readOnly={isSubmitted} />
                </TabsContent>

                <TabsContent value="members">
                  <MemberManager
                    members={stageMembers}
                    profiles={profiles}
                    myProfileId={myProfileId}
                    setMembers={setStageMembers}
                    readOnly={isSubmitted}
                  />
                </TabsContent>

                <TabsContent value="setlist">
                  <SetlistEditor
                    songs={songs}
                    setSongs={setSongs}
                    onScheduleMetadata={handleMetadataSchedule}
                    readOnly={isSubmitted}
                  />
                </TabsContent>

                <TabsContent value="stageplot">
                  {isSubmitted ? (
                    <StagePlotPreview members={stageMembers} items={stageItems} />
                  ) : (
                    <StagePlotEditor
                      members={stageMembers}
                      items={stageItems}
                      setMembers={setStageMembers}
                      setItems={setStageItems}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
