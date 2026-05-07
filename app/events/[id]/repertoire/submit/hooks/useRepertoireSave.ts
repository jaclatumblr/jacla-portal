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

    const restoreMemberSnapshot = async () => {
      const { error: deleteError } = await supabase.from("band_members").delete().eq("band_id", band.id);
      if (deleteError) return deleteError;
      if (persistedMemberSnapshot.length === 0) return null;
      const { error: insertError } = await supabase
        .from("band_members")
        .insert(persistedMemberSnapshot, { defaultToNull: false });
      return insertError;
    };

    const restoreSongSnapshot = async () => {
      const { error: deleteError } = await supabase.from("songs").delete().eq("band_id", band.id);
      if (deleteError) return deleteError;
      if (persistedSongSnapshot.length === 0) return null;
      const { error: insertError } = await supabase
        .from("songs")
        .insert(persistedSongSnapshot, { defaultToNull: false });
      return insertError;
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

    let membersChangedInDb = false;
    let songsChangedInDb = false;

    const { error: deleteMembersForReplaceError } = await supabase
      .from("band_members")
      .delete()
      .eq("band_id", band.id);
    if (deleteMembersForReplaceError) {
      console.error(deleteMembersForReplaceError);
      toast.error("メンバー情報の保存に失敗しました。");
      setSaving(false);
      return;
    }
    membersChangedInDb = true;

    if (memberRowsToSave.length > 0) {
      const { error: insertMembersForReplaceError } = await supabase
        .from("band_members")
        .insert(memberRowsToSave, { defaultToNull: false });

      if (insertMembersForReplaceError) {
        console.error(insertMembersForReplaceError);
        await rollbackRepertoireSave({ restoreMembers: true });
        toast.error("メンバー情報の保存に失敗しました。");
        setSaving(false);
        return;
      }
    }

    const { error: deleteSongsForReplaceError } = await supabase.from("songs").delete().eq("band_id", band.id);
    if (deleteSongsForReplaceError) {
      console.error(deleteSongsForReplaceError);
      await rollbackRepertoireSave({ restoreMembers: membersChangedInDb });
      toast.error("曲情報の保存に失敗しました。");
      setSaving(false);
      return;
    }
    songsChangedInDb = true;

    if (songRowsToSave.length > 0) {
      const { error: insertSongsForReplaceError } = await supabase
        .from("songs")
        .insert(songRowsToSave, { defaultToNull: false });

      if (insertSongsForReplaceError) {
        console.error(insertSongsForReplaceError);
        await rollbackRepertoireSave({ restoreMembers: membersChangedInDb, restoreSongs: true });
        toast.error("曲情報の保存に失敗しました。");
        setSaving(false);
        return;
      }
    }

    const { error: bandWriteError } = await supabase.from("bands").update(bandPayload).eq("id", band.id);
    if (bandWriteError) {
      console.error(bandWriteError);
      await rollbackRepertoireSave({ restoreMembers: membersChangedInDb, restoreSongs: songsChangedInDb });
      toast.error("バンド情報の保存に失敗しました。");
      setSaving(false);
      return;
    }

    toast.success(status === "submitted" ? "提出しました。" : "下書きを保存しました。");
    setBand({ ...band, repertoire_status: status });
    await refreshData();
    setSaving(false);
    return;

    const { error: bandError } = await supabase.from("bands").update(bandPayload).eq("id", band!.id);
    if (bandError) {
      console.error(bandError);
      toast.error("バンド情報の保存に失敗しました。");
      setSaving(false);
      return;
    }

    const { data: currentDbMembers } = await supabase
      .from("band_members")
      .select("id")
      .eq("band_id", band!.id);

    const currentDbIds = new Set(currentDbMembers?.map((member) => member.id) ?? []);
    const localIds = new Set(stageMembers.map((member) => member.id).filter((id) => !id.startsWith("temp-")));

    const toDeleteIds = Array.from(currentDbIds).filter((id) => !localIds.has(id));
    let memberError: { message?: string } | null = null;

    if (toDeleteIds.length > 0) {
      const { error: deleteMemberError } = await supabase
        .from("band_members")
        .delete()
        .in("id", toDeleteIds);
      if (deleteMemberError) {
        memberError = deleteMemberError;
      }
    }

    const hasInvalidMemberUserId = stageMembers.some(
      (member) => !member.userId || member.userId.startsWith("temp-")
    );
    if (hasInvalidMemberUserId) {
      toast.error("メンバーの選択情報が不正です。メンバーを選び直してください。");
      setSaving(false);
      return;
    }

    const memberPayloads = defaultPlotMembers.map((member, index) => {
      const isTemp = member.id.startsWith("temp-");
      return {
        ...(isTemp ? {} : { id: member.id }),
        band_id: band!.id,
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

    const existingMemberPayloads = memberPayloads.filter(
      (payload): payload is (typeof payload & { id: string }) =>
        typeof (payload as { id?: string }).id === "string"
    );
    const newMemberPayloads = memberPayloads.filter(
      (payload) => typeof (payload as { id?: string }).id !== "string"
    );

    if (!memberError && existingMemberPayloads.length > 0) {
      const { error } = await supabase
        .from("band_members")
        .upsert(existingMemberPayloads, { onConflict: "id" });
      if (error) memberError = error;
    }

    if (!memberError && newMemberPayloads.length > 0) {
      const { error } = await supabase
        .from("band_members")
        .insert(newMemberPayloads, { defaultToNull: false });
      if (error) memberError = error;
    }

    if (memberError) {
      console.error(memberError);
      toast.error("メンバー情報の保存に失敗しました。");
    }

    const { data: currentDbSongs } = await supabase
      .from("songs")
      .select("id")
      .eq("band_id", band!.id);

    const dbSongIds = new Set(currentDbSongs?.map((song) => song.id) ?? []);
    const localSongIds = new Set(normalizedSongs.map((song) => song.id).filter((id) => !id.startsWith("temp-")));

    const deleteSongIds = Array.from(dbSongIds).filter((id) => !localSongIds.has(id));
    let songError: { message?: string } | null = null;

    if (deleteSongIds.length > 0) {
      const { error: deleteSongError } = await supabase.from("songs").delete().in("id", deleteSongIds);
      if (deleteSongError) {
        songError = deleteSongError;
      }
    }

    const songPayloads = normalizedSongs.map((song, index) => {
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
        band_id: band!.id,
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

    const existingSongPayloads = songPayloads.filter(
      (payload): payload is (typeof payload & { id: string }) =>
        typeof (payload as { id?: string }).id === "string"
    );
    const newSongPayloads = songPayloads.filter(
      (payload) => typeof (payload as { id?: string }).id !== "string"
    );

    if (!songError && existingSongPayloads.length > 0) {
      const { error } = await supabase.from("songs").upsert(existingSongPayloads, { onConflict: "id" });
      if (error) songError = error;
    }

    if (!songError && newSongPayloads.length > 0) {
      const { error } = await supabase.from("songs").insert(newSongPayloads, { defaultToNull: false });
      if (error) songError = error;
    }

    if (songError) {
      console.error(songError);
      toast.error("曲情報の保存に失敗しました。");
    }

    if (!bandError && !memberError && !songError) {
      toast.success(status === "submitted" ? "提出しました。" : "下書きを保存しました。");
      setBand({ ...band!, repertoire_status: status });
      await refreshData();
    }

    setSaving(false);
  };

  return {
    saving,
    saveRepertoire,
  };
}
