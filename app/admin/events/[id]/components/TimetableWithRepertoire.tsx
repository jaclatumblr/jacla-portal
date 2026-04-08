"use client";

import { useMemo, useState } from "react";
import { Download, Loader2 } from "@/lib/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import { normalizeVoxSetlistLayout } from "@/lib/voxSetlistLayout";
import { SlotManager } from "./SlotManager";
import { RepertoireSection } from "./RepertoireSection";
import type { Band, BandMember, EventRow, EventSlot, Song } from "../types";

type TimetableWithRepertoireProps = {
  event: EventRow;
  eventId: string;
  bands: Band[];
  members: BandMember[];
  songs: Song[];
  slots: EventSlot[];
  setSlots: (slots: EventSlot[] | ((prev: EventSlot[]) => EventSlot[])) => void;
  onRefresh: () => Promise<void>;
};

export function TimetableWithRepertoire({
  event,
  eventId,
  bands,
  members,
  songs,
  slots,
  setSlots,
  onRefresh,
}: TimetableWithRepertoireProps) {
  const firstBandId = useMemo(() => {
    const bandSlot = slots.find((slot) => slot.slot_type === "band" && slot.band_id);
    return bandSlot?.band_id ?? null;
  }, [slots]);

  const [selectedBandId, setSelectedBandId] = useState<string | null>(firstBandId);
  const effectiveBandId = selectedBandId ?? firstBandId;

  const [exportingVoxSetlist, setExportingVoxSetlist] = useState(false);

  const handleExportMatchVoxSetlist = async () => {
    setExportingVoxSetlist(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error("Failed to get access token.");
      }

      // The frontend no longer sends the layout from localStorage. 
      // It relies on the backend's defaultVoxSetlistLayout.

      const response = await fetch(`/api/admin/match-vox-setlist-template`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          eventId,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Failed to export Match Vox setlist (${response.status}): ${errorText}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const contentDisposition = response.headers.get("content-disposition") ?? "";
      const utf8NameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
      const decodedName = utf8NameMatch?.[1]
        ? decodeURIComponent(utf8NameMatch[1])
        : "match-vox-setlist.pdf";
      link.href = downloadUrl;
      link.download = decodedName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Match Vox setlist PDFを出力しました。");
    } catch (error) {
      console.error(error);
      toast.error("Match Vox setlist PDFの出力に失敗しました。");
    } finally {
      setExportingVoxSetlist(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">編集の流れ</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportMatchVoxSetlist}
            disabled={exportingVoxSetlist}
            className="shrink-0"
          >
            {exportingVoxSetlist ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Match Vox setlist PDF出力
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              <span className="font-medium text-foreground">タイムテーブル</span>
              ：同順/逆順・通常リハ/直前リハを選択 → 自動生成/追加 → ドラッグで順序調整。
            </li>
            <li>
              <span className="font-medium text-foreground">レパ表</span>
              ：右側でバンド別に基本情報・ステージ配置・指示・セットリストを確認。
            </li>
            <li>
              <span className="font-medium text-foreground">保存/公開</span>
              ：保存で反映、仮確定でシフト作成解放、公開で全員閲覧。
            </li>
          </ol>
          <p className="text-xs">※ リハ順序/種別の切り替えは即時に並び替えへ反映されます。</p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="md:w-1/2">
          <SlotManager
            event={event}
            bands={bands}
            members={members}
            songs={songs}
            slots={slots}
            setSlots={setSlots}
            onRefresh={onRefresh}
            selectedBandId={effectiveBandId}
            onBandSelect={setSelectedBandId}
          />
        </div>

        <div className="md:w-1/2">
          <RepertoireSection
            eventId={eventId}
            selectedBandId={effectiveBandId}
            hideBandList={true}
            onBandSelect={setSelectedBandId}
            onBandDeleted={onRefresh}
          />
        </div>
      </div>
    </div>
  );
}
