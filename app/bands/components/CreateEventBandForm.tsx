"use client";

import { useRef, useState } from "react";
import { Loader2, Users } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";
import type { EventRow } from "../types";
import { useBandWriteAccess } from "../hooks/useBandWriteAccess";
import { formatDate } from "../types";

type CreateEventBandFormProps = {
  events: EventRow[];
  selectedEventId: string;
  onEventChange: (id: string) => void;
  selfPart: string;
  onCreated: () => Promise<void>;
  showEventSelect?: boolean;
};

export function CreateEventBandForm({
  events,
  selectedEventId,
  onEventChange,
  selfPart,
  onCreated,
  showEventSelect = true,
}: CreateEventBandFormProps) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [bandName, setBandName] = useState("");
  const [instrument, setInstrument] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;

  const { blocked, reason } = useBandWriteAccess(selectedEvent);
  const inFlight = useRef(false);

  const handleCreate = async () => {
    if (!userId || blocked || inFlight.current) return;
    const name = bandName.trim();
    const inst = (instrument ?? selfPart).trim();

    if (!selectedEventId) {
      toast.error("イベントを選択してください。");
      return;
    }
    if (!name) {
      toast.error("バンド名を入力してください。");
      return;
    }
    if (!inst) {
      toast.error("担当パートを入力してください。");
      return;
    }

    inFlight.current = true;
    setCreating(true);
    try {
      const { data: bandData, error: bandError } = await supabase
        .from("bands")
        .insert({
          name,
          band_type: "event",
          event_id: selectedEventId,
          created_by: userId,
        })
        .select("id")
        .maybeSingle();

      if (bandError || !bandData) {
        console.error(bandError);
        toast.error("イベントバンドの作成に失敗しました。");
        return;
      }

      const { error: memberError } = await supabase.from("band_members").insert({
        band_id: bandData.id,
        user_id: userId,
        instrument: inst,
        order_index: 1,
      });

      if (memberError) {
        console.error(memberError);
        const { error: cleanupError } = await supabase.from("bands").delete().eq("id", bandData.id);
        if (cleanupError) console.error(cleanupError);
        toast.error(
          cleanupError
            ? "作成者の参加登録と作成途中バンドの削除に失敗しました。"
            : "作成者の参加登録に失敗したため、作成したバンドを削除しました。"
        );
        return;
      }

      toast.success("イベントバンドを作成しました。");
      setBandName("");
      setInstrument(null);
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error("処理に失敗しました。バンド一覧を確認してください。");
    } finally {
      inFlight.current = false;
      setCreating(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Card className="bg-card/60">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            新規バンドを作成
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {showEventSelect ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">イベント</label>
              <select
                value={selectedEventId}
                onChange={(e) => onEventChange(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
              >
                {events.length === 0 && <option value="">イベントがありません</option>}
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} ({formatDate(event.date)})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">イベント</label>
              <div className="flex min-h-9 w-full items-center rounded-md border border-input bg-muted/60 px-3 text-sm text-foreground">
                {selectedEvent
                  ? `${selectedEvent.name} (${formatDate(selectedEvent.date)})`
                  : "イベント未選択"}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">バンド名</label>
            <Input
              value={bandName}
              onChange={(e) => setBandName(e.target.value)}
              placeholder="例: Jacla Special"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">あなたの担当パート</label>
            <Input
              value={instrument ?? selfPart}
              onChange={(e) => setInstrument(e.target.value)}
              placeholder="例: Gt., Vo."
              className="h-9"
            />
          </div>
          {reason && <p role="status" className="text-sm text-muted-foreground">{reason}</p>}
          <Button onClick={handleCreate} disabled={creating || blocked} className="w-full" size="sm">
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                作成中...
              </>
            ) : (
              "バンドを作成"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
