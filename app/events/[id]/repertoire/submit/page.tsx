"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type EventRow = {
  id: string;
  name: string;
  date: string;
  event_type: string;
};

type BandRow = {
  id: string;
  name: string;
  created_by: string | null;
  repertoire_status: string | null;
  stage_plot_data?: Record<string, unknown> | null;
  representative_name?: string | null;
  sound_note?: string | null;
  lighting_note?: string | null;
  general_note?: string | null;
  lighting_total_min?: number | null;
};

type EntryType = "song" | "mc";
type RepertoireStatus = "draft" | "submitted";

type SongRow = {
  id: string;
  band_id: string;
  title: string;
  artist: string | null;
  entry_type: EntryType | null;
  url: string | null;
  order_index: number | null;
  duration_sec: number | null;
  arrangement_note?: string | null;
  lighting_spot?: string | null;
  lighting_strobe?: string | null;
  lighting_moving?: string | null;
  lighting_color?: string | null;
  memo: string | null;
  created_at?: string | null;
};

type LightingChoice = "o" | "x" | "auto" | "";

type SongEntry = {
  id: string;
  band_id: string;
  entry_type: EntryType;
  title: string;
  artist: string;
  url: string;
  durationMin: string;
  durationSec: string;
  arrangementNote: string;
  lightingSpot: LightingChoice;
  lightingStrobe: LightingChoice;
  lightingMoving: LightingChoice;
  lightingColor: string;
  memo: string;
  order_index: number | null;
};

type ProfileOption = {
  id: string;
  display_name: string | null;
  real_name: string | null;
  part: string | null;
  leader: string | null;
};

type ProfilePartRow = {
  profile_id: string;
  part: string | null;
  is_primary?: boolean | null;
};

type BandMemberRow = {
  id: string;
  band_id: string;
  user_id: string;
  instrument: string;
  position_x: number | null;
  position_y: number | null;
  monitor_request?: string | null;
  monitor_note?: string | null;
  is_mc?: boolean | null;
  profiles?:
    | {
        display_name: string | null;
        real_name: string | null;
        part: string | null;
      }
    | {
        display_name: string | null;
        real_name: string | null;
        part: string | null;
      }[]
    | null;
};

type StageMember = {
  id: string;
  userId: string;
  name: string;
  realName: string | null;
  part: string | null;
  instrument: string;
  x: number;
  y: number;
  monitorRequest: string;
  monitorNote: string;
  isMc: boolean;
};

type StageItem = {
  id: string;
  label: string;
  dashed: boolean;
  x: number;
  y: number;
  fixed?: boolean;
};

type DragHandleProps = Record<string, any>;

const statusOptions: { value: RepertoireStatus; label: string }[] = [
  { value: "draft", label: "下書き" },
  { value: "submitted", label: "提出済み" },
];

const entryTypeLabels: Record<EntryType, string> = {
  song: "曲",
  mc: "MC",
};

const lightingChoiceOptions: { value: LightingChoice; label: string }[] = [
  { value: "", label: "-" },
  { value: "o", label: "○" },
  { value: "x", label: "×" },
  { value: "auto", label: "おまかせ" },
];

const lightingChoiceLabels: Record<Exclude<LightingChoice, "">, string> = {
  o: "○",
  x: "×",
  auto: "おまかせ",
};

const adminLeaderSet = new Set(["Administrator"]);

const createTempId = () => `temp-${crypto.randomUUID()}`;

const toDurationInputs = (duration: number | null) => {
  if (duration == null) return { durationMin: "", durationSec: "" };
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return {
    durationMin: String(minutes),
    durationSec: String(seconds),
  };
};

const toDurationSec = (minutes: string, seconds: string) => {
  const minValue = Number.parseInt(minutes, 10);
  const secValue = Number.parseInt(seconds, 10);
  if (Number.isNaN(minValue) && Number.isNaN(secValue)) return null;
  const safeMin = Number.isNaN(minValue) ? 0 : Math.max(0, minValue);
  const safeSec = Number.isNaN(secValue) ? 0 : Math.max(0, Math.min(59, secValue));
  return safeMin * 60 + safeSec;
};

const formatDuration = (durationSec: number | null) => {
  if (durationSec == null) return "-";
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatLightingChoice = (value: LightingChoice) =>
  value ? lightingChoiceLabels[value as Exclude<LightingChoice, "">] : "-";

const normalizeSongs = (rows: SongRow[]): SongEntry[] =>
  rows.map((row, index) => {
    const durationInputs = toDurationInputs(row.duration_sec ?? null);
    return {
      id: String(row.id),
      band_id: row.band_id,
      entry_type: row.entry_type ?? "song",
      title: row.title ?? "",
      artist: row.artist ?? "",
      url: row.url ?? "",
      durationMin: durationInputs.durationMin,
      durationSec: durationInputs.durationSec,
      arrangementNote: row.arrangement_note ?? "",
      lightingSpot: (row.lighting_spot as LightingChoice) ?? "",
      lightingStrobe: (row.lighting_strobe as LightingChoice) ?? "",
      lightingMoving: (row.lighting_moving as LightingChoice) ?? "",
      lightingColor: row.lighting_color ?? "",
      memo: row.memo ?? "",
      order_index: row.order_index ?? index + 1,
    };
  });

const orderEntries = (entries: SongEntry[]) =>
  [...entries].sort((a, b) => {
    const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });

const isTemp = (id: string) => String(id).startsWith("temp-");

type StageCategory = "drums" | "bass" | "guitar" | "keyboard" | "wind" | "vocal" | "other";

const stageSlots: Record<StageCategory, { x: number; y: number }[]> = {
  drums: [{ x: 50, y: 34 }],
  bass: [{ x: 35, y: 48 }],
  guitar: [
    { x: 65, y: 52 },
    { x: 75, y: 46 },
  ],
  keyboard: [{ x: 82, y: 60 }],
  vocal: [
    { x: 50, y: 82 },
    { x: 40, y: 82 },
    { x: 60, y: 82 },
  ],
  wind: [
    { x: 25, y: 28 },
    { x: 40, y: 28 },
    { x: 55, y: 28 },
    { x: 70, y: 28 },
    { x: 25, y: 40 },
    { x: 40, y: 40 },
    { x: 55, y: 40 },
    { x: 70, y: 40 },
    { x: 25, y: 52 },
    { x: 40, y: 52 },
    { x: 55, y: 52 },
    { x: 70, y: 52 },
  ],
  other: [
    { x: 15, y: 60 },
    { x: 85, y: 60 },
    { x: 15, y: 72 },
    { x: 85, y: 72 },
  ],
};

const stagePresets: { label: string; dashed: boolean }[] = [
  { label: "Passive", dashed: true },
  { label: "Hi・Low", dashed: true },
  { label: "Marshall", dashed: true },
  { label: "JC", dashed: true },
  { label: "LINE1", dashed: true },
  { label: "LINE2", dashed: true },
  { label: "LINE3", dashed: true },
  { label: "LINE4", dashed: true },
  { label: "管1", dashed: true },
  { label: "管2", dashed: true },
  { label: "Gt.1", dashed: false },
  { label: "Gt.2", dashed: false },
  { label: "Ba.", dashed: false },
  { label: "Dr.", dashed: false },
  { label: "Key.", dashed: false },
  { label: "W.syn", dashed: false },
];

const stagePresetPositions: Record<string, { x: number; y: number }> = {
  Marshall: { x: 78, y: 36 },
  JC: { x: 78, y: 52 },
};

const clampPercent = (value: number) => Math.min(95, Math.max(5, value));

const normalizePartText = (value: string | null | undefined) =>
  (value ?? "").toLowerCase().replace(/\s+/g, "");

const includesAny = (value: string, keywords: string[]) =>
  keywords.some((keyword) => value.includes(keyword));

const getStageCategory = (value: string | null | undefined): StageCategory => {
  const text = normalizePartText(value);
  if (!text) return "other";
  if (includesAny(text, ["dr", "drum", "ドラム"])) return "drums";
  if (text.startsWith("ba") || includesAny(text, ["bass", "ベース"])) return "bass";
  if (includesAny(text, ["gt", "gtr", "guitar", "ギター"])) return "guitar";
  if (includesAny(text, ["key", "keys", "keyboard", "piano", "キーボード", "ピアノ"]))
    return "keyboard";
  if (includesAny(text, ["vo", "vocal", "voca", "ボーカル", "歌"])) return "vocal";
  if (
    includesAny(text, [
      "sax",
      "tp",
      "tb",
      "trumpet",
      "trombone",
      "horn",
      "hr",
      "eup",
      "tu",
      "fl",
      "cl",
      "ob",
      "fg",
      "brass",
      "管",
    ])
  ) {
    return "wind";
  }
  return "other";
};

const getFallbackPosition = (index: number) => {
  const cols = 5;
  const row = Math.floor(index / cols);
  const col = index % cols;
  return {
    x: clampPercent(20 + col * 15),
    y: clampPercent(66 + row * 10),
  };
};

const getAutoPosition = (category: StageCategory, index: number) => {
  const slots = stageSlots[category];
  if (index < slots.length) return slots[index];
  return getFallbackPosition(index - slots.length);
};

export default function RepertoireSubmitPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id as string | undefined;
  const { session } = useAuth();
  const {
    isAdmin,
    isPartLeader,
    isPaLeader,
    isLightingLeader,
    loading: roleLoading,
  } = useRoleFlags();
  const userId = session?.user.id;

  const [event, setEvent] = useState<EventRow | null>(null);
  const [allBands, setAllBands] = useState<BandRow[]>([]);
  const [bands, setBands] = useState<BandRow[]>([]);
  const [songCounts, setSongCounts] = useState<Record<string, number>>({});
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [songs, setSongs] = useState<SongEntry[]>([]);
  const [repertoireStatus, setRepertoireStatus] =
    useState<RepertoireStatus>("draft");
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [songsLoading, setSongsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingBandInfo, setSavingBandInfo] = useState(false);
  const [deletingBand, setDeletingBand] = useState(false);
  const [savingPaInfo, setSavingPaInfo] = useState(false);
  const [savingLightingInfo, setSavingLightingInfo] = useState(false);
  const [newBandName, setNewBandName] = useState("");
  const [creatingBand, setCreatingBand] = useState(false);
  const [joinBandId, setJoinBandId] = useState("");
  const [joinInstrument, setJoinInstrument] = useState("");
  const [joining, setJoining] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bandMembers, setBandMembers] = useState<StageMember[]>([]);
  const [bandMembersLoading, setBandMembersLoading] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [subPartsByProfileId, setSubPartsByProfileId] = useState<Record<string, string[]>>({});
  const [memberSearch, setMemberSearch] = useState("");
  const [addMemberId, setAddMemberId] = useState("");
  const [addMemberInstrument, setAddMemberInstrument] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const prevAddMemberIdRef = useRef<string>("");
  const [draggingMemberId, setDraggingMemberId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<
    { id: string; type: "member" | "item"; offsetX: number; offsetY: number } | null
  >(null);
  const dragRafRef = useRef<number | null>(null);
  const dragPendingRef = useRef<
    { id: string; type: "member" | "item"; x: number; y: number } | null
  >(null);
  const [stageItems, setStageItems] = useState<StageItem[]>([]);
  const [stagePreset, setStagePreset] = useState(stagePresets[0]?.label ?? "");
  const [customStageLabel, setCustomStageLabel] = useState("");
  const [bandName, setBandName] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [soundNote, setSoundNote] = useState("");
  const [lightingNote, setLightingNote] = useState("");
  const [generalNote, setGeneralNote] = useState("");
  const [lightingTotal, setLightingTotal] = useState("");
  const [printMode, setPrintMode] = useState<"pa" | "lighting" | null>(null);
  const urlFetchTimers = useRef<Map<string, number>>(new Map());

  const selectedBand = useMemo(
    () => bands.find((band) => band.id === selectedBandId) ?? null,
    [bands, selectedBandId]
  );

  const canManageBands =
    event?.event_type === "live" || event?.event_type === "camp";

  const hasLeaderPrivileges = isAdmin || isPartLeader || isPaLeader || isLightingLeader;
  const isBandOwner = selectedBand?.created_by === userId;
  const isBandMember = bandMembers.some((member) => member.userId === userId);
  const canEditBandMembers =
    canManageBands && (hasLeaderPrivileges || isBandOwner || isBandMember);
  const canDeleteBand =
    canManageBands && Boolean(selectedBandId) && (isBandOwner || isAdmin || isPaLeader || isLightingLeader);

  const joinableBands = useMemo(() => {
    if (allBands.length === 0) return [];
    const editableIds = new Set(bands.map((band) => band.id));
    return allBands.filter((band) => !editableIds.has(band.id));
  }, [allBands, bands]);

  const filteredProfiles = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    const currentIds = new Set(bandMembers.map((member) => member.userId));
    return profiles
      .filter((profile) => !currentIds.has(profile.id))
      .filter((profile) => {
        if (!term) return true;
        const values = [
          profile.display_name ?? "",
          profile.real_name ?? "",
          profile.part ?? "",
        ];
        return values.some((value) => value.toLowerCase().includes(term));
      });
  }, [bandMembers, memberSearch, profiles]);

  const groupedProfiles = useMemo(() => {
    const groups = [
      { key: "guitar", label: "ギター", items: [] as ProfileOption[] },
      { key: "bass", label: "ベース", items: [] as ProfileOption[] },
      { key: "drums", label: "ドラム", items: [] as ProfileOption[] },
      { key: "keyboard", label: "キーボード", items: [] as ProfileOption[] },
      { key: "wind", label: "管楽器", items: [] as ProfileOption[] },
      { key: "vocal", label: "ボーカル", items: [] as ProfileOption[] },
      { key: "other", label: "その他", items: [] as ProfileOption[] },
      { key: "unknown", label: "未設定", items: [] as ProfileOption[] },
    ];
    const groupMap = new Map(groups.map((group) => [group.key, group]));

    filteredProfiles.forEach((profile) => {
      const partLabel = profile.part?.trim() ?? "";
      const category = partLabel ? getStageCategory(partLabel) : "unknown";
      const key = category === "other" ? "other" : category;
      (groupMap.get(key) ?? groupMap.get("unknown"))?.items.push(profile);
    });

    return groups.filter((group) => group.items.length > 0);
  }, [filteredProfiles]);

  const addMemberInstrumentOptions = useMemo(() => {
    if (!addMemberId) return [];
    const selectedProfile = profiles.find((profile) => profile.id === addMemberId);
    if (!selectedProfile) return [];
    const options: string[] = [];
    const mainPart = selectedProfile.part?.trim();
    if (mainPart && mainPart !== "none") {
      options.push(mainPart);
    }
    const subParts = subPartsByProfileId[selectedProfile.id] ?? [];
    subParts.forEach((part) => {
      const value = part?.trim();
      if (!value || value === "none") return;
      if (!options.includes(value)) options.push(value);
    });
    return options;
  }, [addMemberId, profiles, subPartsByProfileId]);

  const bandCountLabel = (bandId: string) => songCounts[bandId] ?? 0;

  const fixedStageItems = useMemo<StageItem[]>(() => {
    const items: StageItem[] = [
      { id: "fixed-main-l", label: "MAIN L", dashed: true, x: 16, y: 82, fixed: true },
      { id: "fixed-main-r", label: "MAIN R", dashed: true, x: 84, y: 82, fixed: true },
      { id: "fixed-mon-1", label: "MON1", dashed: true, x: 12, y: 68, fixed: true },
      { id: "fixed-mon-2", label: "MON2", dashed: true, x: 72, y: 16, fixed: true },
      { id: "fixed-mon-3", label: "MON3", dashed: true, x: 50, y: 82, fixed: true },
      { id: "fixed-mon-4", label: "MON4", dashed: true, x: 88, y: 68, fixed: true },
    ];
    if (bandMembers.some((member) => member.isMc)) {
      items.push({ id: "fixed-mc", label: "MC", dashed: false, x: 50, y: 72, fixed: true });
    }
    return items;
  }, [bandMembers]);

  const orderedSongs = useMemo(() => orderEntries(songs), [songs]);
  const totalDurationSec = useMemo(
    () =>
      orderedSongs.reduce((sum, entry) => {
        const sec = toDurationSec(entry.durationMin, entry.durationSec);
        return sum + (sec ?? 0);
      }, 0),
    [orderedSongs]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const activeEntry = useMemo(
    () =>
      activeId
        ? songs.find((entry) => String(entry.id) === activeId) ?? null
        : null,
    [activeId, songs]
  );

  const activeIndex = useMemo(() => {
    if (!activeId) return -1;
    return orderedSongs.findIndex((entry) => String(entry.id) === activeId);
  }, [activeId, orderedSongs]);

  const loadSongs = useCallback(async (bandId: string) => {
    setSongsLoading(true);

    const { data, error } = await supabase
      .from("songs")
      .select(
        "id, band_id, title, artist, entry_type, url, order_index, duration_sec, arrangement_note, lighting_spot, lighting_strobe, lighting_moving, lighting_color, memo, created_at"
      )
      .eq("band_id", bandId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setSongs([]);
      toast.error("レパートリーの取得に失敗しました。");
    } else {
      setSongs(normalizeSongs((data ?? []) as SongRow[]));
    }
    setRemovedIds([]);
    setSongsLoading(false);
  }, []);

  const loadBandMembers = useCallback(async (bandId: string) => {
    setBandMembersLoading(true);
    const { data, error } = await supabase
      .from("band_members")
      .select(
        "id, band_id, user_id, instrument, position_x, position_y, monitor_request, monitor_note, is_mc, profiles(display_name, real_name, part)"
      )
      .eq("band_id", bandId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      toast.error("バンドメンバーの取得に失敗しました。");
      setBandMembers([]);
      setBandMembersLoading(false);
      return;
    }

    const counters: Record<StageCategory, number> = {
      drums: 0,
      bass: 0,
      guitar: 0,
      keyboard: 0,
      wind: 0,
      vocal: 0,
      other: 0,
    };

    const nextMembers = (data ?? []).map((row) => {
      const memberRow = row as BandMemberRow;
      const profile = Array.isArray(memberRow.profiles)
        ? memberRow.profiles[0] ?? null
        : memberRow.profiles ?? null;
      const instrument = memberRow.instrument ?? "";
      const partLabel = instrument || profile?.part || "";
      const category = getStageCategory(partLabel);
      const index = counters[category]++;
      const fallback = getAutoPosition(category, index);
      const x = memberRow.position_x ?? fallback.x;
      const y = memberRow.position_y ?? fallback.y;
      return {
        id: memberRow.id,
        userId: memberRow.user_id,
        name: profile?.real_name ?? profile?.display_name ?? "名前未登録",
        realName: profile?.real_name ?? null,
        part: profile?.part ?? null,
        instrument,
        x,
        y,
        monitorRequest: memberRow.monitor_request ?? "",
        monitorNote: memberRow.monitor_note ?? "",
        isMc: Boolean(memberRow.is_mc),
      } satisfies StageMember;
    });

    setBandMembers(nextMembers);
    setBandMembersLoading(false);
  }, []);

  const refreshCounts = useCallback(async (bandIds: string[]) => {
    if (bandIds.length === 0) {
      setSongCounts({});
      return;
    }
    const { data, error } = await supabase
      .from("songs")
      .select("id, band_id, entry_type")
      .in("band_id", bandIds);
    if (error) {
      console.error(error);
      return;
    }
    const counts: Record<string, number> = {};
    (data ?? []).forEach((row) => {
      const entry = row as { band_id: string; entry_type?: string | null };
      if (entry.entry_type === "mc") return;
      counts[entry.band_id] = (counts[entry.band_id] ?? 0) + 1;
    });
    setSongCounts(counts);
  }, []);

  const handleCreateBand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newBandName.trim();
    if (!eventId || !name || creatingBand) return;
    if (!canManageBands) {
      toast.error("このイベントではバンドを作成できません。");
      return;
    }
    if (!userId) {
      toast.error("ログイン情報を確認できません。");
      return;
    }
    setCreatingBand(true);
    const { data, error } = await supabase
      .from("bands")
      .insert([
        {
          event_id: eventId,
          name,
          created_by: userId,
          is_approved: false,
        },
      ])
      .select(
        "id, name, created_by, repertoire_status, stage_plot_data, representative_name, sound_note, lighting_note, general_note, lighting_total_min"
      )
      .maybeSingle();
    if (error || !data) {
      console.error(error);
      toast.error("バンドの作成に失敗しました。");
      setCreatingBand(false);
      return;
    }
    const created = data as BandRow;
    setAllBands((prev) => [...prev, created]);
    setBands((prev) => [...prev, created]);
    setSelectedBandId(created.id);
    setSongCounts((prev) => ({ ...prev, [created.id]: 0 }));
    setNewBandName("");
    setCreatingBand(false);
  };

  const handleJoinBand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || joining) return;
    if (!canManageBands) {
      toast.error("このイベントでは参加登録できません。");
      return;
    }
    if (!userId) {
      toast.error("ログイン情報を確認できません。");
      return;
    }
    const bandId = joinBandId;
    const instrument = joinInstrument.trim();
    if (!bandId || !instrument) {
      toast.error("参加するバンドと担当楽器を入力してください。");
      return;
    }
    setJoining(true);
    const { error } = await supabase.from("band_members").insert([
      {
        band_id: bandId,
        user_id: userId,
        instrument,
      },
    ]);
    if (error) {
      console.error(error);
      toast.error("バンドへの参加に失敗しました。");
      setJoining(false);
      return;
    }
    const joinedBand = allBands.find((band) => band.id === bandId);
    if (joinedBand) {
      setBands((prev) =>
        prev.some((band) => band.id === joinedBand.id) ? prev : [...prev, joinedBand]
      );
      setSelectedBandId(joinedBand.id);
      await refreshCounts(
        Array.from(new Set([...bands.map((band) => band.id), joinedBand.id]))
      );
    }
    setJoinBandId("");
    setJoinInstrument("");
    setJoining(false);
  };

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    (async () => {
      const [{ data, error }, { data: leaderRows, error: leaderError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, real_name, part, leader")
          .order("real_name", { ascending: true }),
        supabase
          .from("profile_leaders")
          .select("profile_id, leader")
          .in("leader", ["Administrator"]),
      ]);

      if (cancelled) return;

      if (error) {
        console.error(error);
        toast.error("部員情報の取得に失敗しました。");
        setProfiles([]);
        setSubPartsByProfileId({});
        return;
      }
      if (leaderError) {
        console.error(leaderError);
      }
      const adminIds = new Set(
        (leaderRows ?? []).map((row) => (row as { profile_id?: string }).profile_id).filter(Boolean)
      );
      const nextProfiles = (data ?? []) as ProfileOption[];
      const filtered = nextProfiles.filter(
        (profile) => !adminIds.has(profile.id) && !adminLeaderSet.has(profile.leader ?? "")
      );
      setProfiles(filtered);

      if (filtered.length === 0) {
        setSubPartsByProfileId({});
        return;
      }

      const { data: partsData, error: partsError } = await supabase
        .from("profile_parts")
        .select("profile_id, part, is_primary")
        .in(
          "profile_id",
          filtered.map((profile) => profile.id)
        );

      if (cancelled) return;

      if (partsError) {
        console.error(partsError);
        setSubPartsByProfileId({});
        return;
      }

      const nextMap: Record<string, string[]> = {};
      (partsData ?? []).forEach((row) => {
        const entry = row as ProfilePartRow;
        if (!entry.profile_id) return;
        const partValue = entry.part?.trim();
        if (!partValue || partValue === "none") return;
        if (entry.is_primary) return;
        const bucket = nextMap[entry.profile_id] ?? [];
        if (!bucket.includes(partValue)) {
          bucket.push(partValue);
        }
        nextMap[entry.profile_id] = bucket;
      });
      setSubPartsByProfileId(nextMap);
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!eventId || roleLoading) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      const [eventRes, bandsRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, date, event_type")
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("bands")
          .select(
            "id, name, created_by, repertoire_status, stage_plot_data, representative_name, sound_note, lighting_note, general_note, lighting_total_min"
          )
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;

      if (eventRes.error || !eventRes.data) {
        console.error(eventRes.error);
        toast.error("イベント情報の取得に失敗しました。");
        setEvent(null);
      } else {
        setEvent(eventRes.data as EventRow);
      }

      if (bandsRes.error) {
        console.error(bandsRes.error);
        setAllBands([]);
        setBands([]);
        setSelectedBandId(null);
      } else {
        const allBandList = (bandsRes.data ?? []) as BandRow[];
        setAllBands(allBandList);

        let editableBands: BandRow[] = [];

        if (!userId || allBandList.length === 0) {
          editableBands = [];
        } else {
          const { data: memberData, error: memberError } = await supabase
            .from("band_members")
            .select("band_id")
            .eq("user_id", userId)
            .in(
              "band_id",
              allBandList.map((band) => band.id)
            );
          if (memberError) {
            console.error(memberError);
            editableBands = [];
          } else {
            const memberSet = new Set(
              (memberData ?? []).map((row) => (row as { band_id: string }).band_id)
            );
            editableBands = allBandList.filter(
              (band) => band.created_by === userId || memberSet.has(band.id)
            );
          }
        }

        setBands(editableBands);
        setSelectedBandId((prev) => {
          if (!prev) return editableBands[0]?.id ?? null;
          return editableBands.some((band) => band.id === prev)
            ? prev
            : editableBands[0]?.id ?? null;
        });
        await refreshCounts(editableBands.map((band) => band.id));
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, hasLeaderPrivileges, refreshCounts, roleLoading, userId]);

  useEffect(() => {
    if (!selectedBandId) return;
    void loadSongs(selectedBandId);
  }, [loadSongs, selectedBandId]);

  useEffect(() => {
    if (!selectedBandId) {
      setBandMembers([]);
      setAddMemberId("");
      setAddMemberInstrument("");
      setMemberSearch("");
      return;
    }
    void loadBandMembers(selectedBandId);
  }, [loadBandMembers, selectedBandId]);

  useEffect(() => {
    if (!selectedBand) return;
    const nextStatus =
      (selectedBand.repertoire_status as RepertoireStatus | null) ?? "draft";
    setRepertoireStatus(nextStatus);
  }, [selectedBand]);

  useEffect(() => {
    if (!selectedBand) {
      setBandName("");
      setRepresentativeName("");
      setSoundNote("");
      setLightingNote("");
      setGeneralNote("");
      setLightingTotal("");
      setStageItems([]);
      return;
    }
    setBandName(selectedBand.name ?? "");
    setRepresentativeName(selectedBand.representative_name ?? "");
    setSoundNote(selectedBand.sound_note ?? "");
    setLightingNote(selectedBand.lighting_note ?? "");
    setGeneralNote(selectedBand.general_note ?? "");
    setLightingTotal(
      selectedBand.lighting_total_min != null
        ? String(selectedBand.lighting_total_min)
        : ""
    );
    const rawItems = selectedBand.stage_plot_data?.items;
    if (Array.isArray(rawItems)) {
      const parsed = rawItems
        .map((item) => {
          const entry = item as {
            id?: string;
            label?: string;
            dashed?: boolean;
            x?: number;
            y?: number;
          };
          if (!entry.label) return null;
          return {
            id: entry.id ?? crypto.randomUUID(),
            label: entry.label,
            dashed: Boolean(entry.dashed),
            x: clampPercent(Number(entry.x ?? 50)),
            y: clampPercent(Number(entry.y ?? 50)),
          } satisfies StageItem;
        })
        .filter(Boolean) as StageItem[];
      setStageItems(parsed);
    } else {
      setStageItems([]);
    }
  }, [selectedBand]);

  useEffect(() => {
    if (!addMemberId) {
      setAddMemberInstrument("");
      prevAddMemberIdRef.current = "";
      return;
    }
    const nextDefault = addMemberInstrumentOptions[0] ?? "";
    if (prevAddMemberIdRef.current !== addMemberId) {
      setAddMemberInstrument(nextDefault);
      prevAddMemberIdRef.current = addMemberId;
      return;
    }
    if (!addMemberInstrument || !addMemberInstrumentOptions.includes(addMemberInstrument)) {
      setAddMemberInstrument(nextDefault);
    }
  }, [addMemberId, addMemberInstrument, addMemberInstrumentOptions]);

  useEffect(() => {
    return () => {
      urlFetchTimers.current.forEach((timer) => window.clearTimeout(timer));
      urlFetchTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!printMode) return;
    document.body.dataset.printMode = printMode;
    const timer = window.setTimeout(() => {
      window.print();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [printMode]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintMode(null);
      delete document.body.dataset.printMode;
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  const updateSongField = <K extends keyof SongEntry>(
    id: string,
    key: K,
    value: SongEntry[K]
  ) => {
    const normalizedId = String(id);
    setSongs((prev) =>
      prev.map((entry) =>
        String(entry.id) === normalizedId ? { ...entry, [key]: value } : entry
      )
    );
  };

  const updateBandMemberField = <K extends keyof StageMember>(
    id: string,
    key: K,
    value: StageMember[K]
  ) => {
    setBandMembers((prev) =>
      prev.map((member) => (member.id === id ? { ...member, [key]: value } : member))
    );
  };

  const scheduleMetadataFetch = (id: string, url: string, entryType: EntryType) => {
    if (entryType !== "song") return;
    if (!url.trim()) return;

    const existing = urlFetchTimers.current.get(id);
    if (existing) {
      window.clearTimeout(existing);
    }

    const timer = window.setTimeout(async () => {
      setFetchingMeta((prev) => ({ ...prev, [id]: true }));
      try {
        const res = await fetch("/api/repertoire/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          title?: string | null;
          artist?: string | null;
          duration_sec?: number | null;
        };
        setSongs((prev) =>
          prev.map((entry) => {
            if (entry.id !== id || entry.url.trim() !== url.trim()) return entry;
            const next = { ...entry };
            if (!next.title.trim() && data.title) {
              next.title = data.title;
            }
            if (!next.artist.trim() && data.artist) {
              next.artist = data.artist;
            }
            if (
              !next.durationMin.trim() &&
              !next.durationSec.trim() &&
              data.duration_sec != null
            ) {
              const durationInputs = toDurationInputs(data.duration_sec);
              next.durationMin = durationInputs.durationMin;
              next.durationSec = durationInputs.durationSec;
            }
            return next;
          })
        );
      } catch {
        // noop
      } finally {
        setFetchingMeta((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }, 700);

    urlFetchTimers.current.set(id, timer);
  };

  const addEntry = (entryType: EntryType) => {
    if (!selectedBandId) return;
    const newEntry: SongEntry = {
      id: createTempId(),
      band_id: selectedBandId,
      entry_type: entryType,
      title: entryType === "mc" ? "MC" : "",
      artist: "",
      url: "",
      durationMin: "",
      durationSec: "",
      arrangementNote: "",
      lightingSpot: "",
      lightingStrobe: "",
      lightingMoving: "",
      lightingColor: "",
      memo: "",
      order_index: songs.length + 1,
    };
    setSongs((prev) => [...prev, newEntry]);
  };

  const removeEntry = (id: string) => {
    const normalizedId = String(id);
    setSongs((prev) => prev.filter((entry) => String(entry.id) !== normalizedId));
    if (!isTemp(normalizedId)) {
      setRemovedIds((prev) => [...prev, normalizedId]);
    }
  };

  const moveEntry = (fromIndex: number, toIndex: number) => {
    setSongs((prev) => {
      const ordered = orderEntries(prev);
      const next = arrayMove(ordered, fromIndex, toIndex);
      return next.map((entry, index) => ({ ...entry, order_index: index + 1 }));
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    const activeIdStr = String(active.id);
    if (!over) return;
    const overIdStr = String(over.id);
    if (activeIdStr === overIdStr) return;
    setSongs((prev) => {
      const ordered = orderEntries(prev);
      const oldIndex = ordered.findIndex((entry) => String(entry.id) === activeIdStr);
      const newIndex = ordered.findIndex((entry) => String(entry.id) === overIdStr);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = arrayMove(ordered, oldIndex, newIndex);
      return next.map((entry, index) => ({ ...entry, order_index: index + 1 }));
    });
  };

  const getNextStagePosition = useCallback(
    (instrument: string) => {
      const category = getStageCategory(instrument);
      const count = bandMembers.filter(
        (member) => getStageCategory(member.instrument || member.part) === category
      ).length;
      return getAutoPosition(category, count);
    },
    [bandMembers]
  );

  const handleAddMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedBandId || addingMember) return;
    if (!canEditBandMembers) {
      toast.error("バンドメンバーを編集する権限がありません。");
      return;
    }
    const instrument = addMemberInstrument.trim();
    if (!addMemberId || !instrument) {
      toast.error("追加するメンバーと担当パートを入力してください。");
      return;
    }
    setAddingMember(true);
    const position = getNextStagePosition(instrument);
    const { data, error } = await supabase
      .from("band_members")
      .insert([
        {
          band_id: selectedBandId,
          user_id: addMemberId,
          instrument,
          position_x: position.x,
          position_y: position.y,
          monitor_request: "",
          monitor_note: "",
          is_mc: false,
        },
      ])
      .select(
        "id, band_id, user_id, instrument, position_x, position_y, monitor_request, monitor_note, is_mc, profiles(display_name, real_name, part)"
      )
      .maybeSingle();
    if (error || !data) {
      console.error(error);
      toast.error("メンバーの追加に失敗しました。");
      setAddingMember(false);
      return;
    }

    const row = data as BandMemberRow;
    const profile = Array.isArray(row.profiles)
      ? row.profiles[0] ?? null
      : row.profiles ?? profiles.find((profileItem) => profileItem.id === row.user_id) ?? null;
    const nextMember: StageMember = {
      id: row.id,
      userId: row.user_id,
      name: profile?.real_name ?? profile?.display_name ?? "名前未登録",
      realName: profile?.real_name ?? null,
      part: profile?.part ?? null,
      instrument: row.instrument,
      x: row.position_x ?? position.x,
      y: row.position_y ?? position.y,
      monitorRequest: row.monitor_request ?? "",
      monitorNote: row.monitor_note ?? "",
      isMc: Boolean(row.is_mc),
    };
    setBandMembers((prev) => [...prev, nextMember]);
    setAddMemberId("");
    setAddMemberInstrument("");
    setMemberSearch("");
    setAddingMember(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedBandId || !canEditBandMembers) return;
    const target = bandMembers.find((member) => member.id === memberId);
    if (!target) return;
    const { error } = await supabase.from("band_members").delete().eq("id", memberId);
    if (error) {
      console.error(error);
      toast.error("メンバーの削除に失敗しました。");
      return;
    }
    setBandMembers((prev) => prev.filter((member) => member.id !== memberId));
    if (addMemberId === target.userId) {
      setAddMemberId("");
      setAddMemberInstrument("");
    }
    toast.success("メンバーを削除しました。");
  };

  const saveBandMembers = async (showToast: boolean) => {
    if (!selectedBandId || savingStage) return false;
    if (!canEditBandMembers) {
      if (showToast) {
        toast.error("PA情報を保存する権限がありません。");
      }
      return false;
    }
    setSavingStage(true);
    const updates = bandMembers.map((member) => ({
      id: member.id,
      instrument: member.instrument,
      position_x: member.x,
      position_y: member.y,
      monitor_request: member.monitorRequest.trim() || null,
      monitor_note: member.monitorNote.trim() || null,
      is_mc: member.isMc,
    }));
    const { error } = await supabase.from("band_members").upsert(updates, {
      onConflict: "id",
    });
    if (error) {
      console.error(error);
      if (showToast) {
        toast.error("PA情報の保存に失敗しました。");
      }
      setSavingStage(false);
      return false;
    }
    if (showToast) {
      toast.success("PA情報を保存しました。");
    }
    setSavingStage(false);
    return true;
  };

  const handleSaveStagePositions = async () => {
    await saveBandMembers(true);
  };

  const handleSaveBandInfo = async () => {
    if (!selectedBandId || savingBandInfo) return;
    if (!canEditBandMembers) {
      toast.error("基本情報を保存する権限がありません。");
      return;
    }
    const nextBandName = bandName.trim();
    if (!nextBandName) {
      toast.error("バンド名を入力してください。");
      return;
    }
    setSavingBandInfo(true);
    const { error } = await supabase
      .from("bands")
      .update({
        name: nextBandName,
        representative_name: representativeName.trim() || null,
        general_note: generalNote.trim() || null,
      })
      .eq("id", selectedBandId);
    if (error) {
      console.error(error);
      toast.error("基本情報の保存に失敗しました。");
      setSavingBandInfo(false);
      return;
    }
    setBands((prev) =>
      prev.map((band) =>
        band.id === selectedBandId
          ? {
              ...band,
              name: nextBandName,
              representative_name: representativeName.trim() || null,
              general_note: generalNote.trim() || null,
            }
          : band
      )
    );
    setBandName(nextBandName);
    toast.success("基本情報を保存しました。");
    setSavingBandInfo(false);
  };

  const handleDeleteBand = async () => {
    if (!selectedBandId || deletingBand) return;
    if (!canDeleteBand) {
      toast.error("バンドを削除する権限がありません。");
      return;
    }
    const confirmed = window.confirm("このバンドを削除します。よろしいですか？");
    if (!confirmed) return;
    setDeletingBand(true);
    const { error } = await supabase.from("bands").delete().eq("id", selectedBandId);
    if (error) {
      console.error(error);
      toast.error("バンドの削除に失敗しました。");
      setDeletingBand(false);
      return;
    }
    const nextBands = bands.filter((band) => band.id !== selectedBandId);
    setBands(nextBands);
    setAllBands((prev) => prev.filter((band) => band.id !== selectedBandId));
    setSongCounts((prev) => {
      const next = { ...prev };
      delete next[selectedBandId];
      return next;
    });
    setSelectedBandId((prev) => {
      if (prev !== selectedBandId) return prev;
      return nextBands[0]?.id ?? null;
    });
    toast.success("バンドを削除しました。");
    setDeletingBand(false);
  };

  const handleSavePaInfo = async () => {
    if (!selectedBandId || savingPaInfo) return;
    if (!canEditBandMembers) {
      toast.error("PA情報を保存する権限がありません。");
      return;
    }
    setSavingPaInfo(true);
    const stagePayload = {
      items: stageItems.map((item) => ({
        id: item.id,
        label: item.label,
        dashed: item.dashed,
        x: item.x,
        y: item.y,
      })),
    };
    const { error } = await supabase
      .from("bands")
      .update({
        sound_note: soundNote.trim() || null,
        stage_plot_data: stagePayload,
      })
      .eq("id", selectedBandId);
    if (error) {
      console.error(error);
      toast.error("PA情報の保存に失敗しました。");
      setSavingPaInfo(false);
      return;
    }
    setBands((prev) =>
      prev.map((band) =>
        band.id === selectedBandId
          ? {
              ...band,
              sound_note: soundNote.trim() || null,
              stage_plot_data: stagePayload,
            }
          : band
      )
    );
    const savedMembers = await saveBandMembers(false);
    if (!savedMembers) {
      toast.error("PA情報の保存に失敗しました。");
      setSavingPaInfo(false);
      return;
    }
    toast.success("PA情報を保存しました。");
    setSavingPaInfo(false);
  };

  const handleSaveLightingInfo = async () => {
    if (!selectedBandId || savingLightingInfo) return;
    if (!canEditBandMembers) {
      toast.error("照明情報を保存する権限がありません。");
      return;
    }
    setSavingLightingInfo(true);
    const totalValue = lightingTotal.trim();
    const totalMinutes = totalValue ? Number(totalValue) : null;
    const { error } = await supabase
      .from("bands")
      .update({
        lighting_note: lightingNote.trim() || null,
        lighting_total_min: Number.isFinite(totalMinutes) ? totalMinutes : null,
      })
      .eq("id", selectedBandId);
    if (error) {
      console.error(error);
      toast.error("照明情報の保存に失敗しました。");
      setSavingLightingInfo(false);
      return;
    }
    setBands((prev) =>
      prev.map((band) =>
        band.id === selectedBandId
          ? {
              ...band,
              lighting_note: lightingNote.trim() || null,
              lighting_total_min: Number.isFinite(totalMinutes) ? totalMinutes : null,
            }
          : band
      )
    );
    toast.success("照明情報を保存しました。");
    setSavingLightingInfo(false);
  };

  const handleMarkerPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    memberId: string
  ) => {
    if (!canEditBandMembers) return;
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    dragState.current = {
      id: memberId,
      type: "member",
      offsetX: event.clientX - centerX,
      offsetY: event.clientY - centerY,
    };
    setDraggingMemberId(memberId);
    target.setPointerCapture(event.pointerId);
  };

  const handleStageItemPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    itemId: string
  ) => {
    if (!canEditBandMembers) return;
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    dragState.current = {
      id: itemId,
      type: "item",
      offsetX: event.clientX - centerX,
      offsetY: event.clientY - centerY,
    };
    target.setPointerCapture(event.pointerId);
  };

  const handleStagePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const nextX =
      ((event.clientX - dragState.current.offsetX - rect.left) / rect.width) * 100;
    const nextY =
      ((event.clientY - dragState.current.offsetY - rect.top) / rect.height) * 100;
    const clampedX = clampPercent(nextX);
    const clampedY = clampPercent(nextY);
    dragPendingRef.current = {
      id: dragState.current.id,
      type: dragState.current.type,
      x: clampedX,
      y: clampedY,
    };
    if (dragRafRef.current == null) {
      dragRafRef.current = window.requestAnimationFrame(() => {
        const pending = dragPendingRef.current;
        if (!pending) {
          dragRafRef.current = null;
          return;
        }
        if (pending.type === "member") {
          setBandMembers((prev) =>
            prev.map((member) =>
              member.id === pending.id ? { ...member, x: pending.x, y: pending.y } : member
            )
          );
        } else {
          setStageItems((prev) =>
            prev.map((item) =>
              item.id === pending.id ? { ...item, x: pending.x, y: pending.y } : item
            )
          );
        }
        dragRafRef.current = null;
      });
    }
  };

  const handleStagePointerUp = () => {
    dragState.current = null;
    setDraggingMemberId(null);
    dragPendingRef.current = null;
    if (dragRafRef.current != null) {
      window.cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
  };

  const handleAddStageItem = () => {
    if (!canEditBandMembers) return;
    const label = customStageLabel.trim() || stagePreset;
    if (!label) return;
    const preset = stagePresets.find((item) => item.label === stagePreset);
    const dashed = preset ? preset.dashed : true;
    const index = stageItems.length;
    const presetPosition = preset ? stagePresetPositions[preset.label] : undefined;
    const position = presetPosition ?? getFallbackPosition(index);
    setStageItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label,
        dashed,
        x: position.x,
        y: position.y,
      },
    ]);
    setCustomStageLabel("");
  };

  const handleRemoveStageItem = (itemId: string) => {
    if (!canEditBandMembers) return;
    setStageItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleSave = async () => {
    if (!selectedBandId || saving) return;
    setSaving(true);
    const payloads = orderedSongs.map((entry, index) => ({
      id: entry.id,
      band_id: selectedBandId,
      title: entry.title.trim() || (entry.entry_type === "mc" ? "MC" : ""),
      artist: entry.entry_type === "mc" ? null : entry.artist.trim() || null,
      entry_type: entry.entry_type,
      url: entry.entry_type === "mc" ? null : entry.url.trim() || null,
      order_index: index + 1,
      duration_sec: toDurationSec(entry.durationMin, entry.durationSec),
      arrangement_note:
        entry.entry_type === "mc" ? null : entry.arrangementNote.trim() || null,
      lighting_spot:
        entry.entry_type === "mc" ? null : entry.lightingSpot || null,
      lighting_strobe:
        entry.entry_type === "mc" ? null : entry.lightingStrobe || null,
      lighting_moving:
        entry.entry_type === "mc" ? null : entry.lightingMoving || null,
      lighting_color:
        entry.entry_type === "mc" ? null : entry.lightingColor.trim() || null,
      memo: entry.memo.trim() || null,
    }));

    const updates = payloads.filter((entry) => !isTemp(entry.id));
    const inserts = payloads.filter((entry) => isTemp(entry.id)).map(({ id, ...rest }) => rest);

    if (removedIds.length > 0) {
      const { error } = await supabase.from("songs").delete().in("id", removedIds);
      if (error) {
        console.error(error);
        toast.error("削除に失敗しました。");
        setSaving(false);
        return;
      }
    }

    if (updates.length > 0) {
      const { error } = await supabase.from("songs").upsert(updates, { onConflict: "id" });
      if (error) {
        console.error(error);
        toast.error("更新に失敗しました。");
        setSaving(false);
        return;
      }
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from("songs").insert(inserts);
      if (error) {
        console.error(error);
        toast.error("追加に失敗しました。");
        setSaving(false);
        return;
      }
    }

    if (selectedBand && selectedBand.repertoire_status !== repertoireStatus) {
      const { error } = await supabase
        .from("bands")
        .update({ repertoire_status: repertoireStatus })
        .eq("id", selectedBand.id);
      if (error) {
        console.error(error);
        toast.error("提出状態の更新に失敗しました。");
        setSaving(false);
        return;
      }
      setBands((prev) =>
        prev.map((band) =>
          band.id === selectedBand.id
            ? { ...band, repertoire_status: repertoireStatus }
            : band
        )
      );
    }

    await loadSongs(selectedBandId);
    await refreshCounts(bands.map((band) => band.id));
    toast.success("保存しました。");
    setSaving(false);
  };

  const SongCard = ({
    entry,
    index,
    dragAttributes,
    dragListeners,
    setActivatorRef,
    setNodeRef,
    style,
    isDragging,
    isOverlay,
  }: {
    entry: SongEntry;
    index: number;
    dragAttributes?: DragHandleProps;
    dragListeners?: DragHandleProps;
    setActivatorRef?: (node: HTMLElement | null) => void;
    setNodeRef?: (node: HTMLElement | null) => void;
    style?: CSSProperties;
    isDragging?: boolean;
    isOverlay?: boolean;
  }) => {
    const isSong = entry.entry_type === "song";
    const readOnly = isOverlay === true;
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "rounded-lg border border-border bg-card/70 px-4 py-3 space-y-3",
          isDragging ? "opacity-60" : "",
          isOverlay ? "shadow-xl pointer-events-none" : ""
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
              aria-label="並び替え"
              disabled={readOnly}
              ref={setActivatorRef}
              {...dragAttributes}
              {...dragListeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground w-8">
              {String(index + 1).padStart(2, "0")}
            </span>
            <Badge variant="outline">{entryTypeLabels[entry.entry_type]}</Badge>
          </div>
          <div className="flex-1 min-w-0">
            <Input
              value={entry.title}
              onChange={(event) =>
                updateSongField(entry.id, "title", event.target.value)
              }
              onPointerDown={(event) => event.stopPropagation()}
              placeholder={entry.entry_type === "mc" ? "MCタイトル" : "曲名"}
              className="w-full"
              disabled={readOnly}
            />
          </div>
          <div className="flex items-center gap-1 sm:ml-auto">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => moveEntry(index, Math.max(0, index - 1))}
              disabled={readOnly || index === 0}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                moveEntry(index, Math.min(orderedSongs.length - 1, index + 1))
              }
              disabled={readOnly || index === orderedSongs.length - 1}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeEntry(entry.id)}
              disabled={readOnly}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">アーティスト</span>
            <Input
              value={entry.artist}
              onChange={(event) =>
                updateSongField(entry.id, "artist", event.target.value)
              }
              onPointerDown={(event) => event.stopPropagation()}
              disabled={!isSong || readOnly}
              placeholder={isSong ? "アーティスト" : "-"}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">URL</span>
            <div className="relative">
              <Input
                value={entry.url}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  updateSongField(entry.id, "url", nextValue);
                  if (!readOnly) {
                    scheduleMetadataFetch(entry.id, nextValue, entry.entry_type);
                  }
                }}
                onPointerDown={(event) => event.stopPropagation()}
                disabled={!isSong || readOnly}
                placeholder={isSong ? "YouTube / Spotify / Apple Music" : "-"}
              />
              {fetchingMeta[entry.id] && (
                <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-[160px,1fr]">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">時間(分:秒)</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={entry.durationMin}
                onChange={(event) =>
                  updateSongField(entry.id, "durationMin", event.target.value)
                }
                onPointerDown={(event) => event.stopPropagation()}
                className="w-20"
                disabled={readOnly}
              />
              <span className="text-muted-foreground">:</span>
              <Input
                type="number"
                min={0}
                max={59}
                value={entry.durationSec}
                onChange={(event) =>
                  updateSongField(entry.id, "durationSec", event.target.value)
                }
                onPointerDown={(event) => event.stopPropagation()}
                className="w-20"
                disabled={readOnly}
              />
            </div>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">メモ</span>
            <Textarea
              rows={2}
              value={entry.memo}
              onChange={(event) =>
                updateSongField(entry.id, "memo", event.target.value)
              }
              onPointerDown={(event) => event.stopPropagation()}
              disabled={readOnly}
            />
          </label>
        </div>
      </div>
    );
  };

  const LightingEntryCard = ({ entry, index }: { entry: SongEntry; index: number }) => {
    const isSong = entry.entry_type === "song";
    return (
      <div className="rounded-lg border border-border bg-card/60 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{String(index + 1).padStart(2, "0")}</span>
          <Badge variant="outline">{entryTypeLabels[entry.entry_type]}</Badge>
        </div>
        <div className="space-y-2">
          <Input
            value={entry.title}
            onChange={(event) => updateSongField(entry.id, "title", event.target.value)}
            placeholder={isSong ? "曲名" : "MC"}
            className="h-8 text-xs"
          />
          <Input
            value={entry.artist}
            onChange={(event) => updateSongField(entry.id, "artist", event.target.value)}
            placeholder="アーティスト"
            className="h-8 text-xs"
            disabled={!isSong}
          />
          <div className="relative">
            <Input
              value={entry.url}
              onChange={(event) => {
                const nextValue = event.target.value;
                updateSongField(entry.id, "url", nextValue);
                if (isSong) {
                  scheduleMetadataFetch(entry.id, nextValue, entry.entry_type);
                }
              }}
              placeholder="URL"
              className="h-8 text-xs"
              disabled={!isSong}
            />
            {fetchingMeta[entry.id] && (
              <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            value={entry.durationMin}
            onChange={(event) => updateSongField(entry.id, "durationMin", event.target.value)}
            className="h-8 w-16 text-xs"
          />
          <span className="text-xs text-muted-foreground">:</span>
          <Input
            type="number"
            min={0}
            max={59}
            value={entry.durationSec}
            onChange={(event) => updateSongField(entry.id, "durationSec", event.target.value)}
            className="h-8 w-16 text-xs"
          />
        </div>
        <Textarea
          rows={2}
          value={entry.arrangementNote}
          onChange={(event) => updateSongField(entry.id, "arrangementNote", event.target.value)}
          placeholder="アレンジ/ソロ等"
          className="text-xs"
          disabled={!isSong}
        />
        <div className="grid gap-2 sm:grid-cols-3 text-xs">
          {[
            { key: "lightingSpot", label: "スポット" },
            { key: "lightingStrobe", label: "ストロボ" },
            { key: "lightingMoving", label: "ムービング" },
          ].map((item) => (
            <label key={item.key} className="space-y-1">
              <span className="text-muted-foreground">{item.label}</span>
              <select
                value={entry[item.key as keyof SongEntry] as string}
                onChange={(event) =>
                  updateSongField(
                    entry.id,
                    item.key as keyof SongEntry,
                    event.target.value as LightingChoice
                  )
                }
                className="h-8 w-full rounded-md border border-input bg-card px-2 text-xs"
                disabled={!isSong}
              >
                {lightingChoiceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <Textarea
          rows={2}
          value={entry.lightingColor}
          onChange={(event) => updateSongField(entry.id, "lightingColor", event.target.value)}
          placeholder="色の要望"
          className="text-xs"
          disabled={!isSong}
        />
      </div>
    );
  };

  const SortableSongCard = ({ entry, index }: { entry: SongEntry; index: number }) => {
    const sortableId = String(entry.id);
    const {
      attributes,
      listeners,
      setNodeRef,
      setActivatorNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: sortableId });
    const style: CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
    };
    return (
      <SongCard
        entry={entry}
        index={index}
        dragAttributes={attributes}
        dragListeners={listeners}
        setActivatorRef={setActivatorNodeRef}
        setNodeRef={setNodeRef}
        style={style}
        isDragging={isDragging}
      />
    );
  };

  return (
    <AuthGuard>
      <>
        <div className="flex min-h-screen bg-background print-hide">
          <SideNav />

          <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <ArrowLeft className="w-4 h-4" />
                <Link href={`/events/${eventId}`} className="hover:text-primary transition-colors">
                  イベント詳細に戻る
                </Link>
              </div>
              <div className="max-w-4xl mt-6">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">
                  REPERTOIRE SUBMIT
                </span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-3">
                  レパ表提出
                </h1>
                {event && (
                  <p className="text-muted-foreground text-sm md:text-base">
                    {event.name} / {event.date}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-6">
              {event && !canManageBands ? (
                <div className="rounded-xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
                  このイベントではレパ表の提出・バンド登録はできません。（ライブ/合宿のみ対応）
                </div>
              ) : (
                <div className="grid lg:grid-cols-[0.9fr,1.6fr] gap-6">
                  <Card className="bg-card/60 border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">バンド一覧</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {loading ? (
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          読み込み中...
                        </div>
                      ) : bands.length === 0 ? (
                        <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                          編集できるバンドがありません。
                        </div>
                      ) : (
                        bands.map((band) => {
                          const selected = band.id === selectedBandId;
                          const status = (band.repertoire_status as RepertoireStatus | null) ?? "draft";
                          return (
                            <button
                              key={band.id}
                              type="button"
                              onClick={() => setSelectedBandId(band.id)}
                              className={cn(
                                "w-full text-left rounded-lg border border-border px-4 py-3 transition-colors",
                                selected
                                  ? "border-primary/50 bg-primary/10"
                                  : "bg-card/60 hover:bg-muted/40"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{band.name}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    曲数: {bandCountLabel(band.id)}
                                  </div>
                                </div>
                                <Badge variant={status === "submitted" ? "default" : "secondary"}>
                                  {status === "submitted" ? "提出済み" : "下書き"}
                                </Badge>
                              </div>
                            </button>
                          );
                        })
                      )}

                      <div className="pt-3 border-t border-border/60 space-y-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-foreground">既存バンドに参加する</p>
                          {joinableBands.length === 0 ? (
                            <p className="text-xs text-muted-foreground">参加できるバンドがありません。</p>
                          ) : (
                            <form onSubmit={handleJoinBand} className="flex flex-col gap-2">
                                  <select
                                    value={joinBandId}
                                    onChange={(event) => {
                                      setJoinBandId(event.target.value);
                                    }}
                                    className="h-10 w-full rounded-md border border-input bg-card px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                  >
                                <option value="">バンドを選択</option>
                                {joinableBands.map((band) => (
                                  <option key={band.id} value={band.id}>
                                    {band.name}
                                  </option>
                                ))}
                              </select>
                              <div className="flex flex-col sm:flex-row gap-2">
                                  <Input
                                    value={joinInstrument}
                                    onChange={(event) => {
                                      setJoinInstrument(event.target.value);
                                    }}
                                    placeholder="担当楽器/パート"
                                  />
                                <Button
                                  type="submit"
                                  disabled={!joinBandId || !joinInstrument.trim() || joining}
                                  className="gap-2"
                                >
                                  {joining ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Plus className="w-4 h-4" />
                                  )}
                                  参加する
                                </Button>
                              </div>
                            </form>
                          )}
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-medium text-foreground">新しくバンドを作成する</p>
                          <form onSubmit={handleCreateBand} className="flex flex-col gap-2">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Input
                                value={newBandName}
                                onChange={(event) => {
                                  setNewBandName(event.target.value);
                                }}
                                placeholder="バンド名を入力"
                              />
                              <Button
                                type="submit"
                                disabled={!newBandName.trim() || creatingBand}
                                className="gap-2"
                              >
                                {creatingBand ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Plus className="w-4 h-4" />
                                )}
                                作成
                              </Button>
                            </div>
                          </form>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

﻿
                  <Tabs defaultValue="common" className="space-y-4">
                    <TabsList className="w-full sm:w-auto">
                      <TabsTrigger value="common">共通</TabsTrigger>
                      <TabsTrigger value="pa">PA</TabsTrigger>
                      <TabsTrigger value="lighting">照明</TabsTrigger>
                    </TabsList>

                    <TabsContent value="common" className="space-y-6">
                      <Card className="bg-card/60 border-border">
                        <CardHeader className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <CardTitle className="text-lg">基本情報</CardTitle>
                            <Button
                              type="button"
                              onClick={handleSaveBandInfo}
                              disabled={!selectedBandId || savingBandInfo || !canEditBandMembers}
                              className="gap-2"
                            >
                              {savingBandInfo ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                              保存
                            </Button>
                          </div>
                          {selectedBandId && !canEditBandMembers && (
                            <p className="text-xs text-muted-foreground">
                              基本情報の編集はバンドメンバーまたはパートリーダー以上が行えます。
                            </p>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {!selectedBandId ? (
                            <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              バンドを選択してください。
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1 text-sm">
                                  <span className="text-muted-foreground">イベント名</span>
                                  <p className="font-medium">{event?.name ?? "-"}</p>
                                </div>
                                <label className="space-y-1 text-sm">
                                  <span className="text-muted-foreground">バンド名</span>
                                  <Input
                                    value={bandName}
                                    onChange={(event) => setBandName(event.target.value)}
                                    placeholder="バンド名を入力"
                                    disabled={!canEditBandMembers}
                                  />
                                </label>
                              </div>
                              <label className="space-y-1 text-sm">
                                <span className="text-muted-foreground">代表者氏名</span>
                                <Input
                                  value={representativeName}
                                  onChange={(event) => setRepresentativeName(event.target.value)}
                                  placeholder="代表者名を入力"
                                  disabled={!canEditBandMembers}
                                />
                              </label>
                              <label className="space-y-1 text-sm">
                                <span className="text-muted-foreground">全体メモ</span>
                                <Textarea
                                  rows={3}
                                  value={generalNote}
                                  onChange={(event) => setGeneralNote(event.target.value)}
                                  placeholder="全体を通した相談・備考など"
                                  disabled={!canEditBandMembers}
                                />
                              </label>
                            </div>
                          )}
                          {selectedBandId && canDeleteBand && (
                            <div className="pt-2 flex justify-end">
                              <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDeleteBand}
                                disabled={deletingBand}
                                className="gap-2"
                              >
                                {deletingBand ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                                バンド削除
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="bg-card/60 border-border">
                        <CardHeader className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <CardTitle className="text-lg">セットリスト</CardTitle>
                              <p className="text-xs text-muted-foreground mt-1">
                                自動合計: {formatDuration(totalDurationSec)}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={repertoireStatus}
                                onChange={(event) =>
                                  setRepertoireStatus(event.target.value as RepertoireStatus)
                                }
                                className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                disabled={!selectedBandId}
                              >
                                {statusOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <Button
                                type="button"
                                onClick={handleSave}
                                disabled={!selectedBandId || saving}
                                className="gap-2"
                              >
                                {saving ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4" />
                                )}
                                保存
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => addEntry("song")}
                              disabled={!selectedBandId}
                              className="gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              曲を追加
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => addEntry("mc")}
                              disabled={!selectedBandId}
                              className="gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              MCを追加
                            </Button>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-3">
                          {!selectedBandId ? (
                            <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              バンドを選択してください。
                            </div>
                          ) : songsLoading ? (
                            <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              読み込み中...
                            </div>
                          ) : orderedSongs.length === 0 ? (
                            <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              まだ曲が登録されていません。
                            </div>
                          ) : (
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                              onDragCancel={handleDragCancel}
                            >
                              <SortableContext
                                items={orderedSongs.map((entry) => String(entry.id))}
                                strategy={verticalListSortingStrategy}
                              >
                                <div className="space-y-3">
                                  {orderedSongs.map((entry, index) => (
                                    <SortableSongCard
                                      key={String(entry.id)}
                                      entry={entry}
                                      index={index}
                                    />
                                  ))}
                                </div>
                              </SortableContext>
                              <DragOverlay>
                                {activeEntry ? (
                                  <SongCard
                                    entry={activeEntry}
                                    index={Math.max(0, activeIndex)}
                                    isOverlay
                                  />
                                ) : null}
                              </DragOverlay>
                            </DndContext>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="pa" className="space-y-6">
                      <Card className="bg-card/60 border-border">
                        <CardHeader className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <CardTitle className="text-lg">PAセクション</CardTitle>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                onClick={handleSavePaInfo}
                                disabled={!selectedBandId || savingPaInfo || !canEditBandMembers}
                                className="gap-2"
                              >
                                {savingPaInfo ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4" />
                                )}
                                PA情報を保存
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setPrintMode("pa")}
                                disabled={!selectedBandId}
                              >
                                PDF出力
                              </Button>
                            </div>
                          </div>
                          {selectedBandId && !canEditBandMembers && (
                            <p className="text-xs text-muted-foreground">
                              メンバー追加・配置変更・返しの編集はバンドメンバーまたはパートリーダー以上が行えます。
                            </p>
                          )}
                        </CardHeader>
                        <CardContent>
                          {!selectedBandId ? (
                            <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              バンドを選択してください。
                            </div>
                          ) : bandMembersLoading ? (
                            <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              読み込み中...
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr,1fr]">
                              <div className="space-y-3">
                                <div
                                  ref={stageRef}
                                  onPointerMove={handleStagePointerMove}
                                  onPointerUp={handleStagePointerUp}
                                  onPointerLeave={handleStagePointerUp}
                                  onPointerCancel={handleStagePointerUp}
                                  className="relative w-full h-[280px] sm:h-[360px] rounded-lg border border-border bg-gradient-to-b from-muted/20 to-muted/40 overflow-hidden"
                                >
                                  <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
                                    STAGE
                                  </div>
                                  <div className="absolute top-2 left-3 text-[10px] text-muted-foreground">
                                    舞台奥
                                  </div>
                                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground z-10 bg-background/80 px-1 rounded">
                                    客席
                                  </div>
                                  {fixedStageItems.map((item) => (
                                    <div
                                      key={item.id}
                                      className={cn(
                                        "absolute -translate-x-1/2 -translate-y-1/2 border text-[11px] font-semibold shadow-sm bg-muted/60 text-muted-foreground pointer-events-none",
                                        item.id === "fixed-drums"
                                          ? "h-40 w-44 rounded-2xl flex items-center justify-center"
                                          : "rounded-md px-3 py-2",
                                        item.dashed ? "border-dashed" : "border-solid"
                                      )}
                                      style={{ left: `${item.x}%`, top: `${item.y}%` }}
                                    >
                                      {item.label}
                                    </div>
                                  ))}
                                  {stageItems.map((item) => (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onPointerDown={(event) =>
                                        handleStageItemPointerDown(event, item.id)
                                      }
                                      className={cn(
                                        "absolute -translate-x-1/2 -translate-y-1/2 rounded-md border px-3 py-2 text-[12px] font-semibold shadow-sm touch-none bg-card/90",
                                        item.dashed ? "border-dashed" : "border-solid",
                                        canEditBandMembers
                                          ? "cursor-grab active:cursor-grabbing"
                                          : "cursor-default"
                                      )}
                                      style={{ left: `${item.x}%`, top: `${item.y}%` }}
                                    >
                                      {item.label}
                                    </button>
                                  ))}
                                  {bandMembers.map((member) => (
                                    <button
                                      key={member.id}
                                      type="button"
                                      onPointerDown={(event) =>
                                        handleMarkerPointerDown(event, member.id)
                                      }
                                      className={cn(
                                        "absolute -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-card/90 px-3 py-2 text-left shadow-sm touch-none",
                                        canEditBandMembers
                                          ? "cursor-grab active:cursor-grabbing"
                                          : "cursor-default",
                                        draggingMemberId === member.id
                                          ? "ring-2 ring-primary"
                                          : "hover:border-primary/40"
                                      )}
                                      style={{ left: `${member.x}%`, top: `${member.y}%` }}
                                    >
                                      <span className="block text-[12px] font-semibold leading-tight">
                                        {member.instrument || member.part || "Part"}
                                      </span>
                                      <span className="block text-[12px] text-muted-foreground leading-tight">
                                        {member.name}
                                      </span>
                                    </button>
                                  ))}
                                  <div className="absolute bottom-2 left-3 text-[10px] text-muted-foreground">
                                    下手
                                  </div>
                                  <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">
                                    上手
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                  <span>左が下手 / 右が上手</span>
                                  <span>メンバー数: {bandMembers.length}人</span>
                                </div>
                                {canEditBandMembers && (
                                  <div className="space-y-2">
                                    <p className="text-sm font-medium text-foreground">
                                      箱プリセットを追加
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      <select
                                        value={stagePreset}
                                        onChange={(event) => setStagePreset(event.target.value)}
                                        className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                      >
                                        {stagePresets.map((preset) => (
                                          <option key={preset.label} value={preset.label}>
                                            {preset.label}
                                          </option>
                                        ))}
                                      </select>
                                      <Input
                                        value={customStageLabel}
                                        onChange={(event) =>
                                          setCustomStageLabel(event.target.value)
                                        }
                                        placeholder="カスタム名 (任意)"
                                        className="h-9 min-w-[160px]"
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleAddStageItem}
                                        className="gap-2"
                                      >
                                        <Plus className="h-4 w-4" />
                                        追加
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                {stageItems.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {stageItems.map((item) => (
                                      <div
                                        key={item.id}
                                        className="flex items-center gap-1 rounded-full border border-border bg-card/70 px-2 py-1 text-xs"
                                      >
                                        <span>{item.label}</span>
                                        {canEditBandMembers && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveStageItem(item.id)}
                                            className="text-muted-foreground hover:text-destructive"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-3">
                                {canEditBandMembers && (
                                  <form onSubmit={handleAddMember} className="space-y-2">
                                    <p className="text-sm font-medium text-foreground">
                                      メンバーを追加
                                    </p>
                                    <Input
                                      value={memberSearch}
                                      onChange={(event) => setMemberSearch(event.target.value)}
                                      placeholder="名前/パートで検索"
                                    />
                                    <select
                                      value={addMemberId}
                                      onChange={(event) => setAddMemberId(event.target.value)}
                                      className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    >
                                      <option value="">追加するメンバーを選択</option>
                                      {groupedProfiles.map((group) => (
                                        <optgroup key={group.key} label={group.label}>
                                          {group.items.map((profile) => (
                                            <option key={profile.id} value={profile.id}>
                                              {(profile.real_name ??
                                                profile.display_name ??
                                                "名前未登録") +
                                                (profile.part ? ` (${profile.part})` : "")}
                                            </option>
                                          ))}
                                        </optgroup>
                                      ))}
                                    </select>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <select
                                        value={addMemberInstrument}
                                        onChange={(event) =>
                                          setAddMemberInstrument(event.target.value)
                                        }
                                        disabled={
                                          !addMemberId || addMemberInstrumentOptions.length === 0
                                        }
                                        className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                                      >
                                        <option value="">担当パートを選択</option>
                                        {addMemberInstrumentOptions.map((part) => (
                                          <option key={part} value={part}>
                                            {part}
                                          </option>
                                        ))}
                                      </select>
                                      <Button
                                        type="submit"
                                        disabled={
                                          addingMember ||
                                          !addMemberId ||
                                          !addMemberInstrument.trim()
                                        }
                                        className="gap-2"
                                      >
                                        {addingMember ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Plus className="w-4 h-4" />
                                        )}
                                        追加
                                      </Button>
                                    </div>
                                  </form>
                                )}

                                <div className="rounded-lg border border-border bg-card/40 overflow-x-auto max-w-full">
                                  <Table className="min-w-[520px] w-full">
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-[120px]">パート</TableHead>
                                        <TableHead>名前</TableHead>
                                        <TableHead>返しの希望</TableHead>
                                        <TableHead>備考</TableHead>
                                        <TableHead className="text-center">MC</TableHead>
                                        <TableHead className="text-right">削除</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {bandMembers.length === 0 ? (
                                        <TableRow>
                                          <TableCell
                                            colSpan={6}
                                            className="text-center text-sm text-muted-foreground"
                                          >
                                            メンバーが登録されていません。
                                          </TableCell>
                                        </TableRow>
                                      ) : (
                                        bandMembers.map((member) => (
                                          <TableRow key={member.id}>
                                            <TableCell className="text-xs font-medium">
                                              {member.instrument || member.part || "Part"}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                              {member.name}
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                value={member.monitorRequest}
                                                onChange={(event) =>
                                                  updateBandMemberField(
                                                    member.id,
                                                    "monitorRequest",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="返しの希望"
                                                className="h-8 text-xs"
                                                disabled={!canEditBandMembers}
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                value={member.monitorNote}
                                                onChange={(event) =>
                                                  updateBandMemberField(
                                                    member.id,
                                                    "monitorNote",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="備考"
                                                className="h-8 text-xs"
                                                disabled={!canEditBandMembers}
                                              />
                                            </TableCell>
                                            <TableCell className="text-center">
                                              <input
                                                type="checkbox"
                                                className="h-4 w-4 accent-primary"
                                                checked={member.isMc}
                                                onChange={(event) =>
                                                  updateBandMemberField(
                                                    member.id,
                                                    "isMc",
                                                    event.target.checked
                                                  )
                                                }
                                                disabled={!canEditBandMembers}
                                              />
                                            </TableCell>
                                            <TableCell className="text-right">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveMember(member.id)}
                                                disabled={!canEditBandMembers}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        ))
                                      )}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="bg-card/60 border-border">
                        <CardHeader>
                          <CardTitle className="text-lg">PA要望</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <label className="space-y-1 text-sm">
                            <span className="text-muted-foreground">
                              PA機材・返しの要望
                            </span>
                            <Textarea
                              rows={4}
                              value={soundNote}
                              onChange={(event) => setSoundNote(event.target.value)}
                              placeholder="返し/PA機材などの要望を入力"
                              disabled={!canEditBandMembers}
                            />
                          </label>
                          <div className="space-y-1 text-sm">
                            <span className="text-muted-foreground">全体メモ（共通）</span>
                            <div className="rounded-md border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
                              {generalNote.trim() ? generalNote : "未入力"}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="lighting" className="space-y-6">
                      <Card className="bg-card/60 border-border">
                        <CardHeader className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <CardTitle className="text-lg">照明セットリスト</CardTitle>
                            <Button
                              type="button"
                              onClick={handleSave}
                              disabled={!selectedBandId || saving}
                              className="gap-2"
                            >
                              {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                              セットリスト保存
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <span>自動合計: {formatDuration(totalDurationSec)}</span>
                            <div className="flex flex-wrap items-center gap-2">
                              <span>指定時間</span>
                              <Input
                                value={lightingTotal}
                                onChange={(event) => setLightingTotal(event.target.value)}
                                placeholder="分"
                                className="h-8 w-20 text-xs"
                                disabled={!canEditBandMembers}
                              />
                              <div className="flex items-center gap-1">
                                {[5, 10, 15].map((value) => (
                                  <Button
                                    key={value}
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setLightingTotal(String(value))}
                                    disabled={!canEditBandMembers}
                                  >
                                    {value}分
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {!selectedBandId ? (
                            <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              バンドを選択してください。
                            </div>
                          ) : songsLoading ? (
                            <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              読み込み中...
                            </div>
                          ) : orderedSongs.length === 0 ? (
                            <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              まだ曲が登録されていません。
                            </div>
                          ) : (
                            <>
                              <div className="space-y-3 md:hidden">
                                {orderedSongs.map((entry, index) => (
                                  <LightingEntryCard
                                    key={entry.id}
                                    entry={entry}
                                    index={index}
                                  />
                                ))}
                              </div>
                              <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-card/40">
                                <Table className="min-w-[920px]">
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-[48px]">#</TableHead>
                                      <TableHead>曲名 / アーティスト / URL</TableHead>
                                      <TableHead className="w-[140px]">時間</TableHead>
                                      <TableHead className="w-[180px]">アレンジ等</TableHead>
                                      <TableHead className="w-[200px]">ライト要望</TableHead>
                                      <TableHead className="w-[180px]">色要望</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {orderedSongs.map((entry, index) => {
                                      const isSong = entry.entry_type === "song";
                                      return (
                                        <TableRow key={entry.id}>
                                          <TableCell className="text-xs text-muted-foreground">
                                            {String(index + 1).padStart(2, "0")}
                                          </TableCell>
                                          <TableCell className="min-w-[240px]">
                                            <div className="space-y-1">
                                              <Input
                                                value={entry.title}
                                                onChange={(event) =>
                                                  updateSongField(
                                                    entry.id,
                                                    "title",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder={isSong ? "曲名" : "MC"}
                                                className="h-8 text-xs"
                                              />
                                              <Input
                                                value={entry.artist}
                                                onChange={(event) =>
                                                  updateSongField(
                                                    entry.id,
                                                    "artist",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="アーティスト"
                                                className="h-8 text-xs"
                                                disabled={!isSong}
                                              />
                                              <div className="relative">
                                                <Input
                                                  value={entry.url}
                                                  onChange={(event) => {
                                                    const nextValue = event.target.value;
                                                    updateSongField(
                                                      entry.id,
                                                      "url",
                                                      nextValue
                                                    );
                                                    if (isSong) {
                                                      scheduleMetadataFetch(
                                                        entry.id,
                                                        nextValue,
                                                        entry.entry_type
                                                      );
                                                    }
                                                  }}
                                                  placeholder="URL"
                                                  className="h-8 text-xs"
                                                  disabled={!isSong}
                                                />
                                                {fetchingMeta[entry.id] && (
                                                  <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />
                                                )}
                                              </div>
                                            </div>
                                          </TableCell>
                                          <TableCell className="min-w-[140px]">
                                            <div className="flex items-center gap-1">
                                              <Input
                                                type="number"
                                                min={0}
                                                value={entry.durationMin}
                                                onChange={(event) =>
                                                  updateSongField(
                                                    entry.id,
                                                    "durationMin",
                                                    event.target.value
                                                  )
                                                }
                                                className="h-8 w-16 text-xs"
                                              />
                                              <span className="text-xs text-muted-foreground">
                                                :
                                              </span>
                                              <Input
                                                type="number"
                                                min={0}
                                                max={59}
                                                value={entry.durationSec}
                                                onChange={(event) =>
                                                  updateSongField(
                                                    entry.id,
                                                    "durationSec",
                                                    event.target.value
                                                  )
                                                }
                                                className="h-8 w-16 text-xs"
                                              />
                                            </div>
                                          </TableCell>
                                          <TableCell className="min-w-[180px]">
                                            <Textarea
                                              rows={2}
                                              value={entry.arrangementNote}
                                              onChange={(event) =>
                                                updateSongField(
                                                  entry.id,
                                                  "arrangementNote",
                                                  event.target.value
                                                )
                                              }
                                              placeholder="アレンジ/ソロ等"
                                              className="text-xs"
                                              disabled={!isSong}
                                            />
                                          </TableCell>
                                          <TableCell className="min-w-[200px]">
                                            <div className="grid gap-1 text-xs">
                                              {[
                                                { key: "lightingSpot", label: "スポット" },
                                                { key: "lightingStrobe", label: "ストロボ" },
                                                { key: "lightingMoving", label: "ムービング" },
                                              ].map((item) => (
                                                <label
                                                  key={item.key}
                                                  className="flex items-center justify-between gap-2"
                                                >
                                                  <span>{item.label}</span>
                                                  <select
                                                    value={
                                                      entry[item.key as keyof SongEntry] as string
                                                    }
                                                    onChange={(event) =>
                                                      updateSongField(
                                                        entry.id,
                                                        item.key as keyof SongEntry,
                                                        event.target.value as LightingChoice
                                                      )
                                                    }
                                                    className="h-7 rounded-md border border-input bg-card px-2 text-xs"
                                                    disabled={!isSong}
                                                  >
                                                    {lightingChoiceOptions.map((option) => (
                                                      <option
                                                        key={option.value}
                                                        value={option.value}
                                                      >
                                                        {option.label}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </label>
                                              ))}
                                            </div>
                                          </TableCell>
                                          <TableCell className="min-w-[180px]">
                                            <Textarea
                                              rows={2}
                                              value={entry.lightingColor}
                                              onChange={(event) =>
                                                updateSongField(
                                                  entry.id,
                                                  "lightingColor",
                                                  event.target.value
                                                )
                                              }
                                              placeholder="色の要望"
                                              className="text-xs"
                                              disabled={!isSong}
                                            />
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="bg-card/60 border-border">
                        <CardHeader className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <CardTitle className="text-lg">照明メモ</CardTitle>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                onClick={handleSaveLightingInfo}
                                disabled={
                                  !selectedBandId || savingLightingInfo || !canEditBandMembers
                                }
                                className="gap-2"
                              >
                                {savingLightingInfo ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4" />
                                )}
                                照明情報を保存
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setPrintMode("lighting")}
                                disabled={!selectedBandId}
                              >
                                PDF出力
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <label className="space-y-1 text-sm">
                            <span className="text-muted-foreground">照明要望</span>
                            <Textarea
                              rows={4}
                              value={lightingNote}
                              onChange={(event) => setLightingNote(event.target.value)}
                              placeholder="照明演出の要望を入力"
                              disabled={!canEditBandMembers}
                            />
                          </label>
                          <div className="space-y-1 text-sm">
                            <span className="text-muted-foreground">全体メモ（共通）</span>
                            <div className="rounded-md border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
                              {generalNote.trim() ? generalNote : "未入力"}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          </section>
          </main>
        </div>

        <div className="print-only print-pa">
          <div className="print-page">
            <div className="print-title">PA用</div>
            <div className="print-header">
              <div className="print-field">
                <strong>イベント名:</strong> {event?.name ?? ""}
              </div>
              <div className="print-field">
                <strong>バンド名:</strong> {bandName || selectedBand?.name || ""}
              </div>
              <div className="print-field">
                <strong>代表者氏名:</strong> {representativeName || ""}
              </div>
              <div className="print-field">
                <strong>PA長確認欄:</strong>
                <span className="print-blank-line" />
              </div>
            </div>

            <div>
              <div className="print-section-title">ステージ配置図</div>
              <div className="print-stage">
                <div className="print-stage-label" style={{ top: "2mm", left: "50%", transform: "translateX(-50%)" }}>
                  舞台奥側
                </div>
                <div className="print-stage-label" style={{ bottom: "2mm", left: "50%", transform: "translateX(-50%)" }}>
                  客席側
                </div>
                <div className="print-stage-label" style={{ bottom: "2mm", left: "2mm" }}>
                  下手
                </div>
                <div className="print-stage-label" style={{ bottom: "2mm", right: "2mm" }}>
                  上手
                </div>
                {fixedStageItems.map((item) => (
                  <div
                    key={item.id}
                    className="print-stage-item"
                    style={{
                      left: `${item.x}%`,
                      top: `${item.y}%`,
                      borderStyle: item.dashed ? "dashed" : "solid",
                      opacity: 0.7,
                    }}
                  >
                    {item.label}
                  </div>
                ))}
                {stageItems.map((item) => (
                  <div
                    key={item.id}
                    className="print-stage-item"
                    style={{
                      left: `${item.x}%`,
                      top: `${item.y}%`,
                      borderStyle: item.dashed ? "dashed" : "solid",
                    }}
                  >
                    {item.label}
                  </div>
                ))}
                {bandMembers.map((member) => (
                  <div
                    key={member.id}
                    className="print-stage-member"
                    style={{ left: `${member.x}%`, top: `${member.y}%` }}
                  >
                    <div>{member.instrument || member.part || "Part"}</div>
                    <div>{member.name}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="print-section-title">メンバーリスト & 返しの希望（MC担当者は○）</div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>パート</th>
                    <th>名前</th>
                    <th>返しの希望</th>
                    <th>備考</th>
                    <th>MC</th>
                  </tr>
                </thead>
                <tbody>
                  {bandMembers.length === 0 ? (
                    <tr>
                      <td colSpan={5}>メンバー未登録</td>
                    </tr>
                  ) : (
                    bandMembers.map((member) => (
                      <tr key={member.id}>
                        <td>{member.instrument || member.part || "-"}</td>
                        <td>{member.name}</td>
                        <td>{member.monitorRequest || "-"}</td>
                        <td>{member.monitorNote || "-"}</td>
                        <td>{member.isMc ? "○" : ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <div className="print-section-title">セットリスト（MCも記入）</div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>曲名 / アーティスト</th>
                    <th>時間</th>
                    <th>備考</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedSongs.length === 0 ? (
                    <tr>
                      <td colSpan={4}>未登録</td>
                    </tr>
                  ) : (
                    orderedSongs.map((entry, index) => (
                      <tr key={entry.id}>
                        <td>{index + 1}</td>
                        <td>{entry.artist ? `${entry.title} / ${entry.artist}` : entry.title}</td>
                        <td>{formatDuration(toDurationSec(entry.durationMin, entry.durationSec))}</td>
                        <td>{entry.memo || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <div className="print-section-title">その他音響関係の要望</div>
              <div className="print-note">{soundNote || ""}</div>
            </div>

            <div className="print-footer">Tokyo University of Technology - Jacla</div>
          </div>
        </div>

        <div className="print-only print-lighting">
          <div className="print-page">
            <div className="print-title">照明用</div>
            <div className="print-header">
              <div className="print-field">
                <strong>イベント名:</strong> {event?.name ?? ""}
              </div>
              <div className="print-field">
                <strong>バンド名:</strong> {bandName || selectedBand?.name || ""}
              </div>
              <div className="print-field">
                <strong>代表者氏名:</strong> {representativeName || ""}
              </div>
              <div className="print-field">
                <strong>照明長確認欄:</strong>
                <span className="print-blank-line" />
              </div>
            </div>

            <div>
              <div className="print-section-title">セットリスト（照明用）</div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>曲名 / アーティスト / URL</th>
                    <th>時間</th>
                    <th>アレンジ等</th>
                    <th>ライト要望</th>
                    <th>色要望</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedSongs.length === 0 ? (
                    <tr>
                      <td colSpan={6}>未登録</td>
                    </tr>
                  ) : (
                    orderedSongs.map((entry, index) => (
                      <tr key={entry.id}>
                        <td>{index + 1}</td>
                        <td>
                          <div>{entry.artist ? `${entry.title} / ${entry.artist}` : entry.title}</div>
                          {entry.url && <div>{entry.url}</div>}
                        </td>
                        <td>{formatDuration(toDurationSec(entry.durationMin, entry.durationSec))}</td>
                        <td>{entry.arrangementNote || "-"}</td>
                        <td>
                          <div>スポット: {formatLightingChoice(entry.lightingSpot)}</div>
                          <div>ストロボ: {formatLightingChoice(entry.lightingStrobe)}</div>
                          <div>ムービング: {formatLightingChoice(entry.lightingMoving)}</div>
                        </td>
                        <td>{entry.lightingColor || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="print-field" style={{ marginTop: "3mm" }}>
                合計: {formatDuration(totalDurationSec)} / 指定: {lightingTotal ? `${lightingTotal}分` : "-"}
              </div>
            </div>

            <div>
              <div className="print-section-title">その他照明関係の要望</div>
              <div className="print-note">{lightingNote || ""}</div>
            </div>

            <div>
              <div className="print-section-title">全体を通した相談/備考</div>
              <div className="print-note">{generalNote || ""}</div>
            </div>

            <div className="print-footer">Tokyo University of Technology - Jacla</div>
          </div>
        </div>
      </>
    </AuthGuard>
  );
}
