type BandOrderBand = {
  id: string;
  name?: string | null;
  general_note?: string | null;
  is_jam_session?: boolean | null;
};

type BandOrderSong = {
  band_id: string | null;
  entry_type?: "song" | "mc" | null;
};

type BandOrderMember = {
  band_id: string | null;
  user_id?: string | null;
  instrument?: string | null;
  carry_equipment?: string | null;
};

type Preference = "early" | "late" | "any";

const containsAny = (value: string, needles: string[]) =>
  needles.some((needle) => value.includes(needle));

const parsePreference = (note: string | null | undefined): Preference => {
  const text = (note ?? "").trim();
  if (!text) return "any";
  const earlyTokens = [
    "\u524d\u534a", // 前半
    "\u524d\u306e\u65b9", // 前の方
    "\u65e9\u3081", // 早め
    "\u6700\u521d", // 最初
  ];
  const lateTokens = [
    "\u5f8c\u534a", // 後半
    "\u5f8c\u308d", // 後ろ
    "\u9072\u3081", // 遅め
    "\u6700\u5f8c", // 最後
  ];
  const wantsEarly = containsAny(text, earlyTokens);
  const wantsLate = containsAny(text, lateTokens);
  if (wantsEarly && !wantsLate) return "early";
  if (wantsLate && !wantsEarly) return "late";
  return "any";
};

const hasHeavyGear = (value: string | null | undefined) => {
  const text = (value ?? "").toLowerCase();
  return text.includes("key") || text.includes("syn");
};

export const buildBandOrder = (params: {
  bands: BandOrderBand[];
  songs: BandOrderSong[];
  members: BandOrderMember[];
}) => {
  const { bands, songs, members } = params;
  if (!bands || bands.length === 0) return [];

  const bandIndex = new Map(bands.map((band, index) => [band.id, index]));

  const songCountMap = new Map<string, number>();
  songs.forEach((song) => {
    if (!song.band_id) return;
    if (song.entry_type === "mc") return;
    const current = songCountMap.get(song.band_id) ?? 0;
    songCountMap.set(song.band_id, current + 1);
  });

  const memberSetMap = new Map<string, Set<string>>();
  const memberCountMap = new Map<string, number>();
  const heavyMap = new Map<string, boolean>();

  members.forEach((member) => {
    if (!member.band_id) return;
    const set = memberSetMap.get(member.band_id) ?? new Set<string>();
    if (member.user_id) set.add(member.user_id);
    memberSetMap.set(member.band_id, set);
    memberCountMap.set(member.band_id, (memberCountMap.get(member.band_id) ?? 0) + 1);

    const currentHeavy = heavyMap.get(member.band_id) ?? false;
    if (!currentHeavy) {
      const heavy =
        hasHeavyGear(member.instrument) || hasHeavyGear(member.carry_equipment);
      if (heavy) heavyMap.set(member.band_id, true);
    }
  });

  const features = bands.map((band) => {
    const memberSet = memberSetMap.get(band.id) ?? new Set<string>();
    const memberCount = Math.max(
      memberSet.size,
      memberCountMap.get(band.id) ?? 0
    );
    const songCount = songCountMap.get(band.id) ?? 0;
    const preference = parsePreference(band.general_note);
    const isJam = Boolean(band.is_jam_session);
    const bigBand = memberCount >= 8;
    const heavy = heavyMap.get(band.id) ?? false;
    return {
      band,
      memberSet,
      memberCount,
      songCount,
      preference,
      isJam,
      bigBand,
      heavy,
    };
  });

  const ordered: typeof features = [];
  const remaining = [...features];
  const total = remaining.length;
  const lateStart = Math.floor((total * 2) / 3);
  const earlyEnd = Math.floor(total / 3) - 1;

  const hasOverlap = (a: Set<string>, b: Set<string>) => {
    for (const id of a) {
      if (b.has(id)) return true;
    }
    return false;
  };

  const hasTripleOverlap = (a: Set<string>, b: Set<string>, c: Set<string>) => {
    for (const id of a) {
      if (b.has(id) && c.has(id)) return true;
    }
    return false;
  };

  while (remaining.length > 0) {
    const position = ordered.length;
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      const prev1 = ordered[ordered.length - 1];
      const prev2 = ordered[ordered.length - 2];
      let score = 0;

      if (
        prev1 &&
        prev2 &&
        hasTripleOverlap(candidate.memberSet, prev1.memberSet, prev2.memberSet)
      ) {
        score -= 10000;
      }

      if (prev1 && hasOverlap(candidate.memberSet, prev1.memberSet)) {
        score -= 20;
      }

      if (prev1 && candidate.heavy && prev1.heavy) {
        score += 20;
      }

      const latePreferred =
        candidate.isJam ||
        candidate.bigBand ||
        candidate.songCount >= 3 ||
        candidate.preference === "late";
      if (latePreferred) {
        score += position >= lateStart ? 50 : -50;
        if (candidate.isJam && position >= lateStart) score += 20;
      }

      if (candidate.preference === "early") {
        score += position <= earlyEnd ? 40 : -40;
      }

      score -= (bandIndex.get(candidate.band.id) ?? 0) * 0.01;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const [picked] = remaining.splice(bestIndex, 1);
    ordered.push(picked);
  }

  return ordered.map((entry) => entry.band);
};
