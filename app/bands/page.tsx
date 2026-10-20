"use client";

import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { useEventBands } from "./hooks/useEventBands";
import { useProfiles } from "./hooks/useProfiles";
import { CreateEventBandForm } from "./components/CreateEventBandForm";
import { EventBandList } from "./components/EventBandList";
import { formatDate } from "./types";

export default function BandBuilderPage() {
  const {
    events,
    selectedEventId,
    setSelectedEventId,
    selectedEvent,
    eventBands,
    loading: eventBandsLoading,
    refreshEventBands,
  } = useEventBands();

  const { subPartsByProfileId, selfPart, getFilteredProfiles } = useProfiles();

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Band Builder"
            title="バンドを組む"
            description="出演イベントごとにバンドを作成し、メンバー調整からレパ表提出まで進められます。"
          />

          <section className="py-6 md:py-10">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="mx-auto max-w-6xl space-y-6">
                  <EventBandList
                    key={`list-${selectedEventId}`}
                    loading={eventBandsLoading}
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

                <div className="border-t border-border pt-4">
                  <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
                    新しいイベントバンドを作成
                  </h2>
                  <CreateEventBandForm
                    key={`create-${selectedEventId}`}
                    events={events}
                    selectedEventId={selectedEventId}
                    onEventChange={setSelectedEventId}
                    selfPart={selfPart}
                    onCreated={refreshEventBands}
                    showEventSelect={false}
                  />
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
