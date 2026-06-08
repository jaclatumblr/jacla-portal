"use client";

import { useState } from "react";
import {
  applyStagePlotMemberPositions,
  extractStagePlotMemberPositions,
  normalizeStagePlotsWithTemplateIds,
} from "@/lib/stagePlot";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import {
  BandRow,
  BandMemberRow,
  RepertoireStatus,
  SongEntry,
  SongRow,
  StagePlot,
  StageMember,
  getStageCategory,
  toDurationSec,
} from "../types";

type UseRepertoireSaveProps = {
  band: BandRow | null;
  songs: SongEntry[];
  stageMembers: StageMember[];
  stagePlots: StagePlot[];
  setBand: (band: BandRow) => void;
  setSongs?: (songs: SongEntry[]) => void;
  refreshData: () => Promise<void>;
  submitDeadline?: string | null;
  canBypassDeadline?: boolean;
  submitClosed?: boolean;
  canBypassClose?: boolean;
};

type PersistedBandSnapshot = {
  name: string;
  repertoire_status: string | null;
  representative_name: string | null;
  sound_note: string | null;
  lighting_note: string | null;
  general_note: string | null;
  lighting_total_min: number | null;
  stage_plot_data: Record<string, unknown> | null;
  updated_at: string | null;
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
  band,
  songs,
  stageMembers,
  stagePlots,
  setBand,
  setSongs,
  refreshData,
  submitDeadline,
  canBypassDeadline = false,
  submitClosed,
  canBypassClose = false,
}: UseRepertoireSaveProps) {
  const [saving, setSaving] = useState(false);

  const isDeadlinePassed = (value: string | null | undefined) => {
    if (!value) return false;
    const deadline = new Date(value);
    if (Number.isNaN(deadline.getTime())) return false;
    return Date.now() > deadline.getTime();
  };

  const buildSubmitWarnings = (entries: SongEntry[]) => {
    const warnings: string[] = [];

    const guitarCount = stageMembers.filter(
      (member) => getStageCategory(member.instrument || member.part) === "guitar"
    ).length;
    if (guitarCount > 0) {
      const labels = stagePlots.flatMap((plot) =>
        plot.items.map((item) => item.label.toLowerCase())
      );
      const hasMarshall = labels.includes("marshall");
      const hasJc = labels.includes("jc");
      if (guitarCount === 1) {
        if (!hasMarshall && !hasJc) {
          warnings.push("Gt. がいるのに Marshall / JC が配置されていません。");
        }
      } else if (!hasMarshall || !hasJc) {
        warnings.push("Gt. が複数いるのに Marshall / JC が両方そろっていません。");
      }
    }

    const hasMcMember = stageMembers.some((member) => member.isMc);
    const hasMcEntry = entries.some((entry) => entry.entry_type === "mc");
    if (!hasMcMember) {
      warnings.push("MC担当のメンバーが設定されていません。");
    }
    if (hasMcMember && !hasMcEntry) {
      warnings.push("MC担当がいるのにセットリストにMCがありません。");
    }

    const missingDuration = entries.filter(
      (entry) => toDurationSec(entry.durationMin, entry.durationSec) == null
    ).length;
    if (missingDuration > 0) {
      warnings.push(`演奏時間が未入力の曲が ${missingDuration} 曲あります。`);
    }

    const missingPa = entries.filter(
      (entry) => entry.entry_type !== "mc" && !(entry.memo ?? "").trim()
    ).length;
    if (missingPa > 0) {
      warnings.push(`PAメモが未入力の曲が ${missingPa} 曲あります。`);
    }

    const missingLighting = entries.filter((entry) => {
      if (entry.entry_type === "mc") return false;
      const hasChoice =
        entry.lightingSpot ||
        entry.lightingStrobe ||
        entry.lightingMoving ||
        (entry.lightingColor ?? "").trim();
      return !hasChoice;
    }).length;
    if (missingLighting > 0) {
      warnings.push(`照明指示が未入力の曲が ${missingLighting} 曲あります。`);
    }

    return warnings;
  };

  const normalizeSongsForSave = (entries: SongEntry[]) => {
    let changed = false;
    const normalized = entries.map((entry) => {
      const nextTitle = normalizeTitle(entry);
      const nextPlotId = entry.stagePlotId ?? null;
      if (nextTitle === entry.title && nextPlotId === entry.stagePlotId) return entry;
      changed = true;
      return { ...entry, title: nextTitle, stagePlotId: nextPlotId };
    });
    return { normalized, changed };
  };

  const saveRepertoire = async (status: RepertoireStatus) => {
    if (!band || !band.id) {
      toast.error("バンド情報が取得できません。");
      return;
    }

    const { normalized: normalizedSongs, changed: songsChanged } = normalizeSongsForSave(songs);
    if (songsChanged && setSongs) {
      setSongs(normalizedSongs);
    }

    if (status === "submitted") {
      const isAlreadySubmitted = band.repertoire_status === "submitted";
      if (!isAlreadySubmitted) {
        if (!canBypassClose && submitClosed) {
          toast.error("現在、このイベントは提出が締め切られています。");
          return;
        }
        if (!canBypassDeadline && isDeadlinePassed(submitDeadline)) {
          toast.error("提出締切を過ぎたため提出できません。");
          return;
        }

        const warnings = buildSubmitWarnings(normalizedSongs);
        if (warnings.length > 0) {
          const message = `未入力・不足があります。\n${warnings.join("\n")}\nこのまま提出しますか？`;
          if (!window.confirm(message)) {
            return;
          }
        }
      }
    }

    setSaving(true);

    const normalizedStagePlots = normalizeStagePlotsWithTemplateIds(stagePlots, () => crypto.randomUUID());
    const defaultStagePlotId = normalizedStagePlots[0]?.id ?? null;
    const defaultMemberPositions =
      normalizedStagePlots[0]?.memberPositions ?? extractStagePlotMemberPositions(stageMembers);
    const defaultPlotMembers = applyStagePlotMemberPositions(stageMembers, defaultMemberPositions);
    const songPlotAssignments = Object.fromEntries(
      normalizedSongs.map((entry, index) => {
        const assignmentKey = String(index + 1);
        const assignedPlotId = normalizedStagePlots.some((plot) => plot.id === entry.stagePlotId)
          ? entry.stagePlotId
          : defaultStagePlotId;
        return [assignmentKey, assignedPlotId ?? ""];
      })
    );

    const bandPayload = {
      name: band.name,
      repertoire_status: status,
      representative_name: band.representative_name,
      sound_note: band.sound_note,
      lighting_note: band.lighting_note,
      general_note: band.general_note,
      lighting_total_min: band.lighting_total_min,
      stage_plot_data: {
        items: normalizedStagePlots[0]?.items ?? [],
        plots: normalizedStagePlots,
        songPlotAssignments,
        memberPositions: defaultMemberPositions,
        updatedAt: Date.now(),
        ...(normalizedStagePlots[0]?.items.length === 0 ? { allowEmpty: true } : {}),
      },
      updated_at: new Date().toISOString(),
    };

    const hasInvalidSelectedMember = defaultPlotMembers.some(
      (member) => !member.userId || member.userId.startsWith("temp-")
    );
    if (hasInvalidSelectedMember) {
      toast.error("メンバーの選択情報が不正です。メンバーを選び直してから保存してください。");
      setSaving(false);
      return;
    }

    const [bandSnapshotResult, memberSnapshotResult, songSnapshotResult] = await Promise.all([
      supabase
        .from("bands")
        .select(
          "name, repertoire_status, representative_name, sound_note, lighting_note, general_note, lighting_total_min, stage_plot_data, updated_at"
        )
        .eq("id", band.id)
        .maybeSingle(),
      supabase
        .from("band_members")
        .select(
          "id, band_id, user_id, instrument, position_x, position_y, order_index, monitor_request, monitor_note, is_mc"
        )
        .eq("band_id", band.id),
      supabase
        .from("songs")
        .select(
          "id, band_id, title, artist, entry_type, url, order_index, duration_sec, arrangement_note, lighting_spot, lighting_strobe, lighting_moving, lighting_color, memo"
        )
        .eq("band_id", band.id),
    ]);

    const persistedBandSnapshot = bandSnapshotResult.data as PersistedBandSnapshot | null;
    const persistedMemberSnapshot = (memberSnapshotResult.data ?? []) as BandMemberRow[];
    const persistedSongSnapshot = (songSnapshotResult.data ?? []) as SongRow[];

    if (
      bandSnapshotResult.error ||
      memberSnapshotResult.error ||
      songSnapshotResult.error ||
      !persistedBandSnapshot
    ) {
      console.error(
        bandSnapshotResult.error ?? memberSnapshotResult.error ?? songSnapshotResult.error
      );
      toast.error("保存前のデータ確認に失敗しました。時間を置いて再度お試しください。");
      setSaving(false);
      return;
    }

    const memberRowsToSave = defaultPlotMembers.map((member, index) => {
      const isTemp = member.id.startsWith("temp-");
      return {
        ...(isTemp ? {} : { id: member.id }),
        band_id: band.id,
        user_id: member.userId,
        instrument: member.instrument,
        position_x: member.x,
        position_y: member.y,
        order_index: index + 1,
        monitor_request: member.monitorRequest,
        monitor_note: member.monitorNote,
        is_mc: member.isMc,
      };
    });

    const songRowsToSave = normalizedSongs.map((song, index) => {
      const isTemp = song.id.startsWith("temp-");
      const minValue = Number.parseInt(song.durationMin, 10);
      const secValue = Number.parseInt(song.durationSec, 10);
      const hasDurationInput =
        String(song.durationMin).trim() !== "" || String(song.durationSec).trim() !== "";
      const duration_sec =
        hasDurationInput && (!Number.isNaN(minValue) || !Number.isNaN(secValue))
          ? (Number.isNaN(minValue) ? 0 : Math.max(0, minValue)) * 60 +
            (Number.isNaN(secValue) ? 0 : Math.max(0, Math.min(59, secValue)))
          : null;

      return {
        ...(isTemp ? {} : { id: song.id }),
        band_id: band.id,
        title: song.title,
        artist: normalizeText(song.artist),
        entry_type: song.entry_type ?? "song",
        url: normalizeText(song.url),
        order_index: index + 1,
        duration_sec,
        arrangement_note: normalizeText(song.arrangementNote),
        lighting_spot: song.lightingSpot || null,
        lighting_strobe: song.lightingStrobe || null,
        lighting_moving: song.lightingMoving || null,
        lighting_color: normalizeText(song.lightingColor),
        memo: normalizeText(song.memo),
      };
    });

    if (
      persistedMemberSnapshot.length > 0 &&
      memberRowsToSave.length === 0 &&
      !window.confirm(
        `登録済みのメンバー ${persistedMemberSnapshot.length} 人を全員削除します。よろしいですか？`
      )
    ) {
      setSaving(false);
      return;
    }

    const persistedMemberIds = new Set(persistedMemberSnapshot.map((member) => member.id));
    const persistedSongIds = new Set(persistedSongSnapshot.map((song) => song.id));
    const localMemberIds = new Set(
      memberRowsToSave.flatMap((row) =>
        typeof (row as { id?: string }).id === "string" ? [(row as { id: string }).id] : []
      )
    );
    const localSongIds = new Set(
      songRowsToSave.flatMap((row) =>
        typeof (row as { id?: string }).id === "string" ? [(row as { id: string }).id] : []
      )
    );
    const memberIdsToDelete = Array.from(persistedMemberIds).filter((id) => !localMemberIds.has(id));
    const songIdsToDelete = Array.from(persistedSongIds).filter((id) => !localSongIds.has(id));

    const existingMemberRows = memberRowsToSave.filter(
      (row): row is (typeof row & { id: string }) =>
        typeof (row as { id?: string }).id === "string"
    );
    const newMemberRows = memberRowsToSave.filter(
      (row) => typeof (row as { id?: string }).id !== "string"
    );
    const existingSongRows = songRowsToSave.filter(
      (row): row is (typeof row & { id: string }) =>
        typeof (row as { id?: string }).id === "string"
    );
    const newSongRows = songRowsToSave.filter(
      (row) => typeof (row as { id?: string }).id !== "string"
    );

    const restoreMemberSnapshot = async () => {
      if (persistedMemberSnapshot.length > 0) {
        const { error: upsertError } = await supabase
          .from("band_members")
          .upsert(persistedMemberSnapshot, { onConflict: "id" });
        if (upsertError) return upsertError;
      }

      const { data: currentRows, error: currentRowsError } = await supabase
        .from("band_members")
        .select("id")
        .eq("band_id", band.id);
      if (currentRowsError) return currentRowsError;

      const addedIds = (currentRows ?? [])
        .map((row) => row.id)
        .filter((id) => !persistedMemberIds.has(id));
      if (addedIds.length === 0) return null;

      const { error: deleteError } = await supabase.from("band_members").delete().in("id", addedIds);
      return deleteError;
    };

    const restoreSongSnapshot = async () => {
      if (persistedSongSnapshot.length > 0) {
        const { error: upsertError } = await supabase
          .from("songs")
          .upsert(persistedSongSnapshot, { onConflict: "id" });
        if (upsertError) return upsertError;
      }

      const { data: currentRows, error: currentRowsError } = await supabase
        .from("songs")
        .select("id")
        .eq("band_id", band.id);
      if (currentRowsError) return currentRowsError;

      const addedIds = (currentRows ?? [])
        .map((row) => row.id)
        .filter((id) => !persistedSongIds.has(id));
      if (addedIds.length === 0) return null;

      const { error: deleteError } = await supabase.from("songs").delete().in("id", addedIds);
      return deleteError;
    };

    const restoreBandSnapshot = async () => {
      const { error } = await supabase.from("bands").update(persistedBandSnapshot).eq("id", band.id);
      return error;
    };

    const rollbackRepertoireSave = async (options: {
      restoreBand?: boolean;
      restoreMembers?: boolean;
      restoreSongs?: boolean;
    }) => {
      const rollbackFailures: string[] = [];

      if (options.restoreBand) {
        const rollbackBandError = await restoreBandSnapshot();
        if (rollbackBandError) {
          console.error(rollbackBandError);
          rollbackFailures.push("band");
        }
      }

      if (options.restoreSongs) {
        const rollbackSongError = await restoreSongSnapshot();
        if (rollbackSongError) {
          console.error(rollbackSongError);
          rollbackFailures.push("songs");
        }
      }

      if (options.restoreMembers) {
        const rollbackMemberError = await restoreMemberSnapshot();
        if (rollbackMemberError) {
          console.error(rollbackMemberError);
          rollbackFailures.push("members");
        }
      }

      if (rollbackFailures.length > 0) {
        toast.error(`保存に失敗し、${rollbackFailures.join(" / ")} の復元にも失敗しました。`);
      }
    };

    const failSave = async (
      error: unknown,
      message: string,
      rollback: { restoreBand?: boolean; restoreMembers?: boolean; restoreSongs?: boolean }
    ) => {
      console.error(error);
      await rollbackRepertoireSave(rollback);
      toast.error(message);
      setSaving(false);
    };

    if (existingMemberRows.length > 0) {
      const { error } = await supabase
        .from("band_members")
        .upsert(existingMemberRows, { onConflict: "id" });
      if (error) {
        await failSave(error, "メンバー情報の保存に失敗しました。", { restoreMembers: true });
        return;
      }
    }

    if (newMemberRows.length > 0) {
      const { error } = await supabase
        .from("band_members")
        .insert(newMemberRows, { defaultToNull: false });
      if (error) {
        await failSave(error, "メンバー情報の保存に失敗しました。", { restoreMembers: true });
        return;
      }
    }

    if (existingSongRows.length > 0) {
      const { error } = await supabase.from("songs").upsert(existingSongRows, { onConflict: "id" });
      if (error) {
        await failSave(error, "曲情報の保存に失敗しました。", {
          restoreMembers: true,
          restoreSongs: true,
        });
        return;
      }
    }

    if (newSongRows.length > 0) {
      const { error } = await supabase.from("songs").insert(newSongRows, { defaultToNull: false });
      if (error) {
        await failSave(error, "曲情報の保存に失敗しました。", {
          restoreMembers: true,
          restoreSongs: true,
        });
        return;
      }
    }

    if (songIdsToDelete.length > 0) {
      const { error } = await supabase.from("songs").delete().in("id", songIdsToDelete);
      if (error) {
        await failSave(error, "曲情報の保存に失敗しました。", {
          restoreMembers: true,
          restoreSongs: true,
        });
        return;
      }
    }

    const { error: bandWriteError } = await supabase.from("bands").update(bandPayload).eq("id", band.id);
    if (bandWriteError) {
      await failSave(bandWriteError, "バンド情報の保存に失敗しました。", {
        restoreBand: true,
        restoreMembers: true,
        restoreSongs: true,
      });
      return;
    }

    // Membership grants write permission, so remove departed members only after every other write.
    if (memberIdsToDelete.length > 0) {
      const { error } = await supabase.from("band_members").delete().in("id", memberIdsToDelete);
      if (error) {
        await failSave(error, "メンバー情報の保存に失敗しました。", {
          restoreBand: true,
          restoreMembers: true,
          restoreSongs: true,
        });
        return;
      }
    }

    toast.success(status === "submitted" ? "提出しました。" : "下書きを保存しました。");
    setBand({ ...band, repertoire_status: status });
    await refreshData();
    setSaving(false);
  };

  return {
    saving,
    saveRepertoire,
  };
}
