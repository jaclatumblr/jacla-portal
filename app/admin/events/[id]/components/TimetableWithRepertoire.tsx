"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SlotManager } from "./SlotManager";
import { RepertoireSection } from "./RepertoireSection";
import type { Band, EventRow, EventSlot, Song } from "../types";

type TimetableWithRepertoireProps = {
  event: EventRow;
  eventId: string;
  bands: Band[];
  songs: Song[];
  slots: EventSlot[];
  setSlots: (slots: EventSlot[] | ((prev: EventSlot[]) => EventSlot[])) => void;
  onRefresh: () => Promise<void>;
};

export function TimetableWithRepertoire({
  event,
  eventId,
  bands,
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

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">編集の流れ</CardTitle>
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
          />
        </div>
      </div>
    </div>
  );
}
