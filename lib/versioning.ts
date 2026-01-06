const DEFAULT_BASE_VERSION = "1.000";

const normalizeVersionInput = (value: string) =>
  value.replace(/^ver\.?\s*/i, "").replace(/^v/i, "").trim();

const parseVersion = (value: string) => {
  const cleaned = normalizeVersionInput(value);
  const match = cleaned.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  const major = Number(match[1]);
  const minorRaw = match[2] ?? "0";
  const width = Math.max(minorRaw.length, 3);
  const minor = Number(minorRaw);
  if (Number.isNaN(major) || Number.isNaN(minor)) return null;
  return { major, minor, width };
};

export const BASE_VERSION = (() => {
  const raw = normalizeVersionInput(
    process.env.NEXT_PUBLIC_BASE_VERSION || DEFAULT_BASE_VERSION
  );
  return parseVersion(raw) ? raw : DEFAULT_BASE_VERSION;
})();

export const bumpVersion = (base: string, bumps: number) => {
  const parsed = parseVersion(base) ?? parseVersion(DEFAULT_BASE_VERSION);
  if (!parsed) return DEFAULT_BASE_VERSION;
  const max = 10 ** parsed.width;
  const nextMinor = parsed.minor + bumps;
  const major = parsed.major + Math.floor(nextMinor / max);
  const minor = nextMinor % max;
  return `${major}.${String(minor).padStart(parsed.width, "0")}`;
};

export type VersionedLog = {
  id: string;
  created_at: string;
  is_version_bump?: boolean | null;
};

export const buildVersionMap = (
  logs: VersionedLog[],
  baseVersion: string = BASE_VERSION
) => {
  const sorted = [...logs].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const map = new Map<string, string>();
  let bumpCount = 0;
  sorted.forEach((log) => {
    if (log.is_version_bump) bumpCount += 1;
    map.set(log.id, bumpVersion(baseVersion, bumpCount));
  });
  return map;
};

export const formatVersionLabel = (value: string | null | undefined) =>
  value ? `Ver. ${value}` : "Ver. -";
