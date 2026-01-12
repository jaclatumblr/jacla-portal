"use client";

import { Loader2 } from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkeletonCard } from "@/components/ui/skeleton";
import { useEventBands } from "./hooks/useEventBands";
import { useFixedBands } from "./hooks/useFixedBands";
import { useProfiles } from "./hooks/useProfiles";
import { CreateEventBandForm } from "./components/CreateEventBandForm";
import { EventBandList } from "./components/EventBandList";
import { CreateFixedBandForm } from "./components/CreateFixedBandForm";
import { FixedBandSelector } from "./components/FixedBandSelector";
import { FixedBandDetail } from "./components/FixedBandDetail";
import { formatDate } from "./types";

export default function BandBuilderPage() {
  // フックによるデータ取得
  const {
    events,
    selectedEventId,
    setSelectedEventId,
    selectedEvent,
    eventBands,
    loading: eventBandsLoading,
    refreshEventBands,
  } = useEventBands();

  const {
    fixedBands,
    selectedBandId,
    setSelectedBandId,
    selectedBand,
    members: fixedMembers,
    loading: fixedBandsLoading,
    membersLoading: fixedMembersLoading,
    refreshFixedBands,
    refreshMembers: refreshFixedMembers,
  } = useFixedBands();

  const { profiles, subPartsByProfileId, selfPart, loading: profilesLoading, getFilteredProfiles } =
    useProfiles();

  const handleFixedBandCreated = async (newBandId: string) => {
    await refreshFixedBands();
    setSelectedBandId(newBandId);
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Band Builder"
            title="バンドを組む"
            description="イベントごとの編成と固定バンドをまとめて管理できます。"
          />

          <section className="py-6 md:py-10">
            <div className="container mx-auto px-4 sm:px-6">
              <Tabs defaultValue="event" className="max-w-6xl mx-auto">
                <TabsList className="grid w-full max-w-sm grid-cols-2 mb-6">
                  <TabsTrigger value="event">イベントバンド</TabsTrigger>
                  <TabsTrigger value="fixed">固定バンド</TabsTrigger>
                </TabsList>

                {/* イベントバンドタブ */}
                <TabsContent value="event" className="space-y-6">
                  {/* バンド一覧（先に表示） */}
                  {eventBandsLoading ? (
                    <div className="space-y-3">
                      <SkeletonCard />
                      <SkeletonCard />
                    </div>
                  ) : (
                    <EventBandList
                      events={events}
                      selectedEventId={selectedEventId}
                      onEventChange={setSelectedEventId}
                      bands={eventBands}
                      eventName={selectedEvent?.name ?? null}
                      eventDate={selectedEvent?.date ? formatDate(selectedEvent.date) : null}
                      selfPart={selfPart}
                      subPartsByProfileId={subPartsByProfileId}
                      getFilteredProfiles={getFilteredProfiles}
                      onRefresh={refreshEventBands}
                    />
                  )}

                  {/* 作成フォーム（後に表示） */}
                  <div className="pt-4 border-t border-border">
                    <h2 className="text-sm font-semibold text-muted-foreground mb-4">
                      新しいバンドを作成
                    </h2>
                    <CreateEventBandForm
                      events={events}
                      selectedEventId={selectedEventId}
                      onEventChange={setSelectedEventId}
                      fixedBands={fixedBands}
                      selfPart={selfPart}
                      onCreated={refreshEventBands}
                      showEventSelect={false}
                    />
                  </div>
                </TabsContent>

                {/* 固定バンドタブ */}
                <TabsContent value="fixed" className="space-y-6">
                  <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                    {/* 左サイドバー */}
                    <div className="space-y-4">
                      <FixedBandSelector
                        bands={fixedBands}
                        selectedId={selectedBandId}
                        onSelect={setSelectedBandId}
                        loading={fixedBandsLoading}
                      />
                      <CreateFixedBandForm
                        selfPart={selfPart}
                        onCreated={handleFixedBandCreated}
                      />
                    </div>

                    {/* 右メイン */}
                    <FixedBandDetail
                      band={selectedBand}
                      members={fixedMembers}
                      membersLoading={fixedMembersLoading}
                      profiles={profiles}
                      subPartsByProfileId={subPartsByProfileId}
                      getFilteredProfiles={getFilteredProfiles}
                      onRefreshBands={refreshFixedBands}
                      onRefreshMembers={refreshFixedMembers}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
