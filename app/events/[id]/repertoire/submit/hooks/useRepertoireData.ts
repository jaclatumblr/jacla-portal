"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import {
  BandRow,
  EventRow,
  ProfileOption,
  RepertoireDraft,
  SongEntry,
  StageItem,
  StageMember,
  getStageCategory,
  normalizeSongs,
  orderEntries,
  stageSlots,
} from "../types";

const clampPercent = (value: number) => Math.min(95, Math.max(5, value));

type UseRepertoireDataResult = {
  loading: boolean;
  error: string | null;
  event: EventRow | null;
  band: BandRow | null;
  availableBands: BandRow[];
  selectedBandId: string | null;
  songs: SongEntry[];
  stageMembers: StageMember[];
  stageItems: StageItem[];
  profiles: ProfileOption[];
  myProfileId: string | null;
  repertoireStatus: "draft" | "submitted";
  lastSavedAt: string | null;

  setSongs: (songs: SongEntry[] | ((prev: SongEntry[]) => SongEntry[])) => void;
  setStageMembers: (members: StageMember[] | ((prev: StageMember[]) => StageMember[])) => void;
  setStageItems: (items: StageItem[] | ((prev: StageItem[]) => StageItem[])) => void;
  setBand: (band: BandRow | null | ((prev: BandRow | null) => BandRow | null)) => void;
  setSelectedBandId: (bandId: string | null) => void;

  refreshData: () => Promise<void>;
  restoreFromDraft: (draft: RepertoireDraft) => void;
  clearDraft: () => void;
};

type RepertoireOptions = {
  adminMode?: boolean;
  initialBandId?: string | null;
};

const normalizeDraftSongs = (draftSongs: SongEntry[]) =>
  draftSongs.map((entry, index) => ({
    ...entry,
    entry_type: entry.entry_type ?? "song",
    title: typeof entry.title === "string" ? entry.title : "",
    artist: typeof entry.artist === "string" ? entry.artist : "",
    url: typeof entry.url === "string" ? entry.url : "",
    durationMin: typeof entry.durationMin === "string" ? entry.durationMin : "",
    durationSec: typeof entry.durationSec === "string" ? entry.durationSec : "",
    arrangementNote: typeof entry.arrangementNote === "string" ? entry.arrangementNote : "",
    lightingSpot: entry.lightingSpot ?? "",
    lightingStrobe: entry.lightingStrobe ?? "",
    lightingMoving: entry.lightingMoving ?? "",
    lightingColor: typeof entry.lightingColor === "string" ? entry.lightingColor : "",
    memo: typeof entry.memo === "string" ? entry.memo : "",
    order_index: entry.order_index ?? index + 1,
  }));

export function useRepertoireData(
  eventId: string,
  userId?: string,
  options?: RepertoireOptions
): UseRepertoireDataResult {
  const adminMode = options?.adminMode ?? false;
  const initialBandId = options?.initialBandId ?? null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [event, setEvent] = useState<EventRow | null>(null);
  const [band, setBand] = useState<BandRow | null>(null);
  const [availableBands, setAvailableBands] = useState<BandRow[]>([]);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [songs, setSongs] = useState<SongEntry[]>([]);
  const [stageMembers, setStageMembers] = useState<StageMember[]>([]);
  const [stageItems, setStageItems] = useState<StageItem[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [repertoireStatus, setRepertoireStatus] = useState<"draft" | "submitted">("draft");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    if (!eventId || !userId) return;
    setLoading(true);
    setError(null);

    try {
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("id, name, date, event_type, repertoire_deadline, repertoire_is_closed")
        .eq("id", eventId)
        .single();

      if (eventError || !eventData) {
        throw new Error("イベントが取得できません。");
      }
      setEvent(eventData as EventRow);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();
      setMyProfileId(profileData?.id ?? null);

      const bandSelect = `
        id, name, created_by, repertoire_status, stage_plot_data,
        representative_name, sound_note, lighting_note, general_note, lighting_total_min,
        band_members(user_id)
      `;

      const { data: bandsData, error: bandsError } = await supabase
        .from("bands")
        .select(bandSelect)
        .eq("event_id", eventId)
        .eq("band_type", "event")
        .order("created_at", { ascending: true });

      if (bandsError) throw bandsError;

      const bandListRaw = (bandsData ?? []) as (BandRow & {
        band_members?: { user_id: string }[] | null;
      })[];
      const bandList = adminMode
        ? bandListRaw
        : bandListRaw.filter((entry) => {
          if (!userId) return false;
          if (entry.created_by === userId) return true;
          const members = Array.isArray(entry.band_members) ? entry.band_members : [];
          return members.some((member) => member.user_id === userId);
        });

      setAvailableBands(bandList);

      const hasSelected = selectedBandId ? bandList.some((entry) => entry.id === selectedBandId) : false;
      const hasInitial =
        !selectedBandId && initialBandId
          ? bandList.some((entry) => entry.id === initialBandId)
          : false;
      const nextBandId = hasInitial ? initialBandId : hasSelected ? selectedBandId : bandList[0]?.id ?? null;

      if (nextBandId !== selectedBandId) {
        setSelectedBandId(nextBandId);
      }

      const foundBand = bandList.find((entry) => entry.id === nextBandId);

      if (!foundBand) {
        setBand(null);
        setSongs([]);
        setStageMembers([]);
        setStageItems([]);
        setRepertoireStatus("draft");
        setLoading(false);
        return;
      }

      setBand(foundBand);
      setRepertoireStatus((foundBand.repertoire_status as "draft" | "submitted") ?? "draft");

      const [songsRes, membersRes, allProfilesRes] = await Promise.all([
        supabase
          .from("songs")
          .select("*")
          .eq("band_id", foundBand.id)
          .order("order_index", { ascending: true }),
        supabase
          .from("band_members")
          .select(
            `
            id, band_id, user_id, instrument, position_x, position_y, order_index, 
            created_at, monitor_request, monitor_note, is_mc,
            profiles (display_name, real_name, part)
          `
          )
          .eq("band_id", foundBand.id)
          .order("order_index", { ascending: true }),
        supabase.from("profiles").select("id, display_name, real_name, part, leader"),
      ]);

      if (songsRes.error) console.error(songsRes.error);
      if (membersRes.error) console.error(membersRes.error);

      setSongs(orderEntries(normalizeSongs(songsRes.data || [])));

      type ProfileResponse = { id: string; display_name: string | null; real_name: string | null; part: string | null; leader: string | null };
      const pOptions = (allProfilesRes.data ?? []).map((p: ProfileResponse) => ({
        id: p.id,
        user_id: p.id, // profiles.id is the user_id
        display_name: p.display_name,
        real_name: p.real_name,
        part: p.part,
        leader: p.leader,
      }));
      setProfiles(pOptions);

      const categoryCounts: Record<string, number> = {};
      type MemberResponse = {
        id: string;
        user_id: string;
        instrument: string | null;
        position_x: number | null;
        position_y: number | null;
        order_index: number | null;
        monitor_request: string | null;
        monitor_note: string | null;
        is_mc: boolean | null;
        profiles: { display_name: string | null; real_name: string | null; part: string | null } | { display_name: string | null; real_name: string | null; part: string | null }[] | null;
      };
      const bMembers = (membersRes.data ?? []).map((m: MemberResponse) => {
        const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        const instrumentValue = m.instrument ?? "";
        const partValue = p?.part ?? null;
        const category = getStageCategory(instrumentValue || partValue);
        const currentIndex = categoryCounts[category] ?? 0;
        categoryCounts[category] = currentIndex + 1;
        const hasPosition = m.position_x != null && m.position_y != null;
        const slot = stageSlots[category]?.[currentIndex];
        const fallback = {
          x: clampPercent(20 + (currentIndex % 4) * 10),
          y: clampPercent(70 + Math.floor(currentIndex / 4) * 6),
        };
        const resolvedPosition = slot ?? fallback;
        return {
          id: m.id,
          userId: m.user_id,
          name: p?.display_name ?? "Unknown",
          realName: p?.real_name ?? null,
          part: p?.part ?? null,
          instrument: instrumentValue,
          x: hasPosition ? m.position_x : resolvedPosition.x,
          y: hasPosition ? m.position_y : resolvedPosition.y,
          orderIndex: m.order_index,
          monitorRequest: m.monitor_request ?? "",
          monitorNote: m.monitor_note ?? "",
          isMc: m.is_mc ?? false,
        };
      }) as StageMember[];

      setStageMembers(bMembers);

      type StagePlotData = { items?: StageItem[]; updatedAt?: string } | null;
      const plotData = foundBand.stage_plot_data as StagePlotData;
      if (plotData?.items && Array.isArray(plotData.items)) {
        setStageItems(plotData.items);
      } else {
        setStageItems([]);
      }

      if (plotData?.updatedAt) {
        setLastSavedAt(new Date(plotData.updatedAt).toLocaleString());
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "データ読み込みエラー";
      console.error(err);
      setError(errorMessage);
      toast.error("データの読み込みに失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [adminMode, eventId, initialBandId, userId, selectedBandId]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const restoreFromDraft = (draft: RepertoireDraft) => {
    setBand((prev) =>
      prev
        ? {
          ...prev,
          name: draft.bandName,
          representative_name: draft.representativeName,
          general_note: draft.generalNote,
          sound_note: draft.soundNote,
          lighting_note: draft.lightingNote,
          lighting_total_min: Number(draft.lightingTotal) || null,
        }
        : null
    );

    setSongs(orderEntries(normalizeDraftSongs(draft.songs)));
    setStageItems(draft.stageItems);
    setStageMembers(draft.bandMembers);

    toast.success("一時保存を復元しました。");
  };

  const clearDraft = useCallback(() => {
    // Local clean up logic if needed
  }, []);

  return {
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
  };
}
