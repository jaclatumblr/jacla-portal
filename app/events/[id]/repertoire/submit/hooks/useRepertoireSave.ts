"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import {
  BandRow,
  RepertoireStatus,
  SongEntry,
  StageItem,
  StageMember,
  getStageCategory,
  toDurationSec,
} from "../types";

type UseRepertoireSaveProps = {
  eventId: string;
  band: BandRow | null;
  songs: SongEntry[];
  stageMembers: StageMember[];
  stageItems: StageItem[];
  setBand: (band: BandRow) => void;
  refreshData: () => Promise<void>;
};

const normalizeText = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeTitle = (entry: SongEntry) => {
  const trimmed = (entry.title ?? "").trim();
  if (trimmed) return trimmed;
  return entry.entry_type === "mc" ? "MC" : "曲";
};

export function useRepertoireSave({
  eventId,
  band,
  songs,
  stageMembers,
  stageItems,
  setBand,
  refreshData,
}: UseRepertoireSaveProps) {
  const [saving, setSaving] = useState(false);

  const buildSubmitWarnings = () => {
    const warnings: string[] = [];

    const hasGuitar = stageMembers.some(
      (member) => getStageCategory(member.instrument || member.part) === "guitar"
    );
    if (hasGuitar) {
      const labels = stageItems.map((item) => item.label.toLowerCase());
      const hasMarshall = labels.includes("marshall");
      const hasJc = labels.includes("jc");
      if (!hasMarshall || !hasJc) {
        warnings.push("Gt.がいるのに Marshall / JC が配置されていません。");
      }
    }

    const hasMcMember = stageMembers.some((member) => member.isMc);
    const hasMcEntry = songs.some((entry) => entry.entry_type === "mc");
    if (!hasMcMember) {
      warnings.push("MC担当のメンバーが設定されていません。");
    }
    if (hasMcMember && !hasMcEntry) {
      warnings.push("MC担当がいるのにセトリにMCがありません。");
    }

    const missingDuration = songs.filter(
      (entry) => toDurationSec(entry.durationMin, entry.durationSec) == null
    ).length;
    if (missingDuration > 0) {
      warnings.push(`演奏時間が未入力の曲が${missingDuration}件あります。`);
    }

    const missingPa = songs.filter(
      (entry) => entry.entry_type !== "mc" && !(entry.memo ?? "").trim()
    ).length;
    if (missingPa > 0) {
      warnings.push(`PA指示が未入力の曲が${missingPa}件あります。`);
    }

    const missingLighting = songs.filter((entry) => {
      if (entry.entry_type === "mc") return false;
      const hasChoice =
        entry.lightingSpot ||
        entry.lightingStrobe ||
        entry.lightingMoving ||
        (entry.lightingColor ?? "").trim();
      return !hasChoice;
    }).length;
    if (missingLighting > 0) {
      warnings.push(`照明指示が未入力の曲が${missingLighting}件あります。`);
    }

    return warnings;
  };

  const saveRepertoire = async (status: RepertoireStatus) => {
    if (!band?.id) {
      toast.error("バンド情報が取得できません。");
      return;
    }

    if (status === "submitted") {
      const warnings = buildSubmitWarnings();
      if (warnings.length > 0) {
        const message = `未記入・不足があります。\n${warnings.join("\n")}\nこのまま提出しますか？`;
        if (!window.confirm(message)) {
          return;
        }
      }
    }

    setSaving(true);

    const bandPayload = {
      name: band.name,
      repertoire_status: status,
      representative_name: band.representative_name,
      sound_note: band.sound_note,
      lighting_note: band.lighting_note,
      general_note: band.general_note,
      lighting_total_min: band.lighting_total_min,
      stage_plot_data: {
        items: stageItems,
        updatedAt: Date.now(),
      },
      updated_at: new Date().toISOString(),
    };

    const { error: bandError } = await supabase.from("bands").update(bandPayload).eq("id", band.id);

    if (bandError) {
      console.error(bandError);
      toast.error("バンド情報の保存に失敗しました。");
      setSaving(false);
      return;
    }

    const { data: currentDbMembers } = await supabase
      .from("band_members")
      .select("id")
      .eq("band_id", band.id);

    const currentDbIds = new Set(currentDbMembers?.map((m) => m.id) ?? []);
    const localIds = new Set(stageMembers.map((m) => m.id).filter((id) => !id.startsWith("temp-")));

    const toDeleteIds = Array.from(currentDbIds).filter((id) => !localIds.has(id));
    if (toDeleteIds.length > 0) {
      await supabase.from("band_members").delete().in("id", toDeleteIds);
    }

    const memberPayloads = stageMembers.map((m, index) => {
      const isTemp = m.id.startsWith("temp-");
      return {
        ...(isTemp ? {} : { id: m.id }),
        band_id: band.id,
        user_id: m.userId.startsWith("temp-") ? null : m.userId,
        instrument: m.instrument,
        position_x: m.x,
        position_y: m.y,
        order_index: index + 1,
        monitor_request: m.monitorRequest,
        monitor_note: m.monitorNote,
        is_mc: m.isMc,
      };
    });

    const { error: memberError } = await supabase.from("band_members").upsert(memberPayloads);

    if (memberError) {
      console.error(memberError);
      toast.error("メンバー情報の保存に失敗しました。");
    }

    const { data: currentDbSongs } = await supabase
      .from("songs")
      .select("id")
      .eq("band_id", band.id);

    const dbSongIds = new Set(currentDbSongs?.map((s) => s.id) ?? []);
    const localSongIds = new Set(songs.map((s) => s.id).filter((id) => !id.startsWith("temp-")));
    const deleteSongIds = Array.from(dbSongIds).filter((id) => !localSongIds.has(id));

    if (deleteSongIds.length > 0) {
      await supabase.from("songs").delete().in("id", deleteSongIds);
    }

    const songPayloads = songs.map((s, index) => {
      const isTemp = s.id.startsWith("temp-");
      const minValue = Number.parseInt(s.durationMin, 10);
      const secValue = Number.parseInt(s.durationSec, 10);
      const hasDurationInput = String(s.durationMin).trim() !== "" || String(s.durationSec).trim() !== "";
      const duration_sec =
        hasDurationInput && (!Number.isNaN(minValue) || !Number.isNaN(secValue))
          ? (Number.isNaN(minValue) ? 0 : Math.max(0, minValue)) * 60 +
            (Number.isNaN(secValue) ? 0 : Math.max(0, Math.min(59, secValue)))
          : null;

      return {
        ...(isTemp ? {} : { id: s.id }),
        band_id: band.id,
        title: normalizeTitle(s),
        artist: normalizeText(s.artist),
        entry_type: s.entry_type ?? "song",
        url: normalizeText(s.url),
        order_index: index + 1,
        duration_sec,
        arrangement_note: normalizeText(s.arrangementNote),
        lighting_spot: s.lightingSpot || null,
        lighting_strobe: s.lightingStrobe || null,
        lighting_moving: s.lightingMoving || null,
        lighting_color: normalizeText(s.lightingColor),
        memo: normalizeText(s.memo),
      };
    });

    const { error: songError } = await supabase.from("songs").upsert(songPayloads);

    if (songError) {
      console.error(songError);
      toast.error("曲情報の保存に失敗しました。");
    }

    if (!bandError && !memberError && !songError) {
      toast.success(status === "submitted" ? "提出しました。" : "下書き保存しました。");
      setBand({ ...band, repertoire_status: status });
      await refreshData();
    }

    setSaving(false);
  };

  return {
    saving,
    saveRepertoire,
  };
}
