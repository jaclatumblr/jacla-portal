import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Workbook } from "exceljs";
import type { Worksheet, CellValue } from "exceljs";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isAdminLeader = (leader?: string | null) =>
  leader === "Administrator" || leader === "Supervisor";

const rosterDir = "\u8cc7\u6599";
const rosterTemplateCandidates = [
  "event-member-roster (1).xlsx",
  "\u69cb\u6210\u54e1\u540d\u7c3f.xlsx",
];
const allMembersSheetName = "Sheet1";
const eventMembersSheetName = "Sheet1 (2)";

const rolePriority = ["President", "Treasurer", "\u90e8\u9577", "\u4f1a\u8a08"];

const roleLabelMap: Record<string, string> = {
  President: "\u90e8\u9577",
  Treasurer: "\u4f1a\u8a08",
  "\u90e8\u9577": "\u90e8\u9577",
  "\u4f1a\u8a08": "\u4f1a\u8a08",
};

type SupabaseErrorLike = { code?: string | null; message?: string | null };
type LeaderRow = { leader?: string | null };
type ProfileRow = {
  id?: string | null;
  display_name?: string | null;
  real_name?: string | null;
  leader?: string | null;
};
type BandMemberRow = { user_id?: string | null };
type ProfilePrivateRow = { profile_id?: string | null; student_id?: string | null; phone_number?: string | null };
type PositionRow = { profile_id?: string | null; position?: string | null };
type ProfileLeaderRow = { profile_id?: string | null; leader?: string | null };
type EventRow = { name?: string | null };

type RosterEntry = {
  profileId: string;
  name: string;
  studentId: string;
  phoneNumber: string;
  role: string;
};

const sanitizeFileName = (value: string) =>
  value.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();

const normalizeStudentId = (studentId: string | null | undefined) =>
  (studentId ?? "").trim().toUpperCase();

const shouldExcludeByStudentId = (studentId: string | null | undefined) => {
  const normalized = normalizeStudentId(studentId);
  return normalized.startsWith("G");
};

const resolveRoleLabel = (roles: string[]) => {
  if (roles.length === 0) return "";
  const sorted = [...roles].sort((a, b) => {
    const rankA = rolePriority.indexOf(a);
    const rankB = rolePriority.indexOf(b);
    const normalizedA = rankA === -1 ? Number.MAX_SAFE_INTEGER : rankA;
    const normalizedB = rankB === -1 ? Number.MAX_SAFE_INTEGER : rankB;
    if (normalizedA !== normalizedB) return normalizedA - normalizedB;
    return a.localeCompare(b, "ja");
  });
  const top = sorted[0];
  return roleLabelMap[top] ?? "";
};

const cellText = (value: CellValue): string => {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  return "";
};

const detectDataStartRow = (sheet: Worksheet): number => {
  const maxProbe = Math.max(20, Math.min(sheet.rowCount, 200));
  for (let row = 1; row <= maxProbe; row += 1) {
    const colA = cellText(sheet.getCell(row, 1).value);
    const colB = cellText(sheet.getCell(row, 2).value);
    if (colA === "NO" && colB === "\u5f79\u8077") {
      return row + 1;
    }
  }
  return 9;
};

const isMissingTableError = (error: SupabaseErrorLike | null | undefined) => {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /does not exist/i.test(message) ||
    /relation .* does not exist/i.test(message)
  );
};

const isMissingColumnError = (error: SupabaseErrorLike | null | undefined) => {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  return code === "42703" || /column .* does not exist/i.test(message);
};

const writeEntriesToSheet = (sheet: Worksheet, entries: RosterEntry[]) => {
  const dataStartRow = detectDataStartRow(sheet);
  const clearToRow = sheet.rowCount;
  const capacity = Math.max(0, clearToRow - dataStartRow + 1);
  if (entries.length > capacity) {
    throw new Error(`Template capacity exceeded: ${entries.length}/${capacity}`);
  }

  for (let row = dataStartRow; row <= clearToRow; row += 1) {
    for (let col = 1; col <= 6; col += 1) {
      sheet.getCell(row, col).value = null;
    }
  }

  entries.forEach((entry, index) => {
    const row = dataStartRow + index;
    sheet.getCell(row, 1).value = index + 1;
    sheet.getCell(row, 2).value = entry.role || null;
    sheet.getCell(row, 3).value = entry.studentId || null;
    sheet.getCell(row, 4).value = entry.name;
    sheet.getCell(row, 5).value = entry.phoneNumber || null;
    sheet.getCell(row, 6).value = entry.phoneNumber || null;
  });
};

const buildRosterWorkbook = async (
  templateBuffer: Buffer,
  allMemberEntries: RosterEntry[],
  eventMemberEntries: RosterEntry[]
) => {
  const workbook = new Workbook();
  await workbook.xlsx.load(templateBuffer);

  const allSheet = workbook.getWorksheet(allMembersSheetName) ?? workbook.worksheets[0];
  const eventSheet = workbook.getWorksheet(eventMembersSheetName) ?? workbook.worksheets[1];

  if (!allSheet) throw new Error("All members sheet not found.");
  if (!eventSheet) throw new Error("Event members sheet not found.");

  writeEntriesToSheet(allSheet, allMemberEntries);
  writeEntriesToSheet(eventSheet, eventMemberEntries);

  return Buffer.from(await workbook.xlsx.writeBuffer());
};

const sortRosterEntries = (entries: RosterEntry[]) => {
  entries.sort((a, b) => {
    const aHasStudent = a.studentId.length > 0;
    const bHasStudent = b.studentId.length > 0;
    if (aHasStudent && bHasStudent) {
      const byStudent = a.studentId.localeCompare(b.studentId, "ja");
      if (byStudent !== 0) return byStudent;
    }
    if (aHasStudent !== bHasStudent) return aHasStudent ? -1 : 1;
    return a.name.localeCompare(b.name, "ja");
  });
};

const buildEntriesFromIds = (
  ids: string[],
  nameMap: Map<string, string>,
  privateMap: Map<string, { studentId: string; phoneNumber: string }>,
  roleMap: Map<string, string[]>
): RosterEntry[] => {
  const entries = ids
    .filter((profileId) => !shouldExcludeByStudentId(privateMap.get(profileId)?.studentId))
    .map((profileId) => {
      const privateData = privateMap.get(profileId);
      return {
        profileId,
        name: nameMap.get(profileId) ?? "\u672a\u767b\u9332",
        studentId: privateData?.studentId ?? "",
        phoneNumber: privateData?.phoneNumber ?? "",
        role: resolveRoleLabel(roleMap.get(profileId) ?? []),
      };
    });
  sortRosterEntries(entries);
  return entries;
};

export async function GET(request: Request) {
  const url = supabaseUrl ?? "";
  const anonKey = supabaseAnonKey ?? "";
  const serviceKey = supabaseServiceKey ?? "";
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json(
      { error: "Server configuration missing (Supabase keys)." },
      { status: 500 }
    );
  }

  const eventId = new URL(request.url).searchParams.get("eventId")?.trim() ?? "";
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let leaders: string[] = [];
  const { data: leaderRows, error: leaderError } = await adminClient
    .from("profile_leaders")
    .select("leader")
    .eq("profile_id", userData.user.id);

  if (leaderError) {
    console.error(leaderError);
  } else {
    leaders = (leaderRows ?? [])
      .map((row) => (row as LeaderRow).leader)
      .filter((leader): leader is string => Boolean(leader) && leader !== "none");
  }

  if (leaders.length === 0) {
    const { data: profileRow, error: profileError } = await adminClient
      .from("profiles")
      .select("leader")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error(profileError);
    }

    const fallbackLeader = (profileRow as LeaderRow | null)?.leader;
    if (fallbackLeader && fallbackLeader !== "none") {
      leaders = [fallbackLeader];
    }
  }

  if (!leaders.some(isAdminLeader)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: eventData, error: eventError } = await adminClient
    .from("events")
    .select("name")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError) {
    console.error(eventError);
    return NextResponse.json({ error: "Failed to fetch event." }, { status: 500 });
  }
  if (!eventData) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const profileSelectCandidates = [
    "id, display_name, real_name, leader",
    "id, display_name, leader",
    "id, display_name, real_name",
    "id, display_name",
  ];
  let profileRows: ProfileRow[] = [];
  let profileFetchError: SupabaseErrorLike | null = null;

  for (const columns of profileSelectCandidates) {
    const { data, error } = await adminClient
      .from("profiles")
      .select(columns)
      .order("display_name", { ascending: true });
    if (error) {
      profileFetchError = error as SupabaseErrorLike;
      if (isMissingColumnError(profileFetchError)) {
        continue;
      }
      console.error(error);
      return NextResponse.json({ error: "Failed to fetch profiles." }, { status: 500 });
    }
    profileRows = (data ?? []) as ProfileRow[];
    profileFetchError = null;
    break;
  }

  if (profileFetchError) {
    console.error(profileFetchError);
    return NextResponse.json({ error: "Failed to fetch profiles." }, { status: 500 });
  }

  const nameMap = new Map<string, string>();
  const adminIds = new Set<string>();
  const allProfileIds: string[] = [];

  profileRows.forEach((row) => {
    const profileId = row.id?.trim();
    if (!profileId) return;
    const name = row.real_name?.trim() || row.display_name?.trim() || "\u672a\u767b\u9332";
    nameMap.set(profileId, name);
    allProfileIds.push(profileId);
    if (row.leader?.trim() === "Administrator") {
      adminIds.add(profileId);
    }
  });

  const profileLeadersRes = await adminClient
    .from("profile_leaders")
    .select("profile_id, leader")
    .eq("leader", "Administrator");

  if (profileLeadersRes.error) {
    if (!isMissingTableError(profileLeadersRes.error as SupabaseErrorLike)) {
      console.error(profileLeadersRes.error);
      return NextResponse.json({ error: "Failed to fetch profile leaders." }, { status: 500 });
    }
  } else {
    ((profileLeadersRes.data ?? []) as ProfileLeaderRow[]).forEach((row) => {
      const profileId = row.profile_id?.trim();
      if (!profileId) return;
      adminIds.add(profileId);
    });
  }

  const allMemberIds = allProfileIds.filter((id) => !adminIds.has(id));

  const { data: bandRows, error: bandError } = await adminClient
    .from("bands")
    .select("id")
    .eq("event_id", eventId)
    .eq("band_type", "event");
  if (bandError) {
    console.error(bandError);
    return NextResponse.json({ error: "Failed to fetch event bands." }, { status: 500 });
  }

  const bandIds = (bandRows ?? [])
    .map((row) => (row as { id?: string | null }).id)
    .filter((id): id is string => Boolean(id));

  const eventMemberIdSet = new Set<string>();
  if (bandIds.length > 0) {
    const { data: memberRows, error: memberError } = await adminClient
      .from("band_members")
      .select("user_id")
      .in("band_id", bandIds);
    if (memberError) {
      console.error(memberError);
      return NextResponse.json({ error: "Failed to fetch band members." }, { status: 500 });
    }

    ((memberRows ?? []) as BandMemberRow[]).forEach((row) => {
      const userId = row.user_id?.trim();
      if (!userId) return;
      if (adminIds.has(userId)) return;
      eventMemberIdSet.add(userId);
      if (!nameMap.has(userId)) {
        nameMap.set(userId, "\u672a\u767b\u9332");
      }
    });
  }

  const eventMemberIds = Array.from(eventMemberIdSet.values());

  const targetProfileIds = Array.from(new Set([...allMemberIds, ...eventMemberIds]));
  const privateMap = new Map<string, { studentId: string; phoneNumber: string }>();
  const roleMap = new Map<string, string[]>();

  if (targetProfileIds.length > 0) {
    let privateData: ProfilePrivateRow[] = [];

    const privateRes = await adminClient
      .from("profile_private")
      .select("profile_id, student_id, phone_number")
      .in("profile_id", targetProfileIds);

    if (privateRes.error && isMissingColumnError(privateRes.error as SupabaseErrorLike)) {
      const fallbackPrivateRes = await adminClient
        .from("profile_private")
        .select("profile_id, student_id")
        .in("profile_id", targetProfileIds);

      if (fallbackPrivateRes.error) {
        if (!isMissingTableError(fallbackPrivateRes.error as SupabaseErrorLike)) {
          console.error(fallbackPrivateRes.error);
          return NextResponse.json({ error: "Failed to fetch private profile data." }, { status: 500 });
        }
      } else {
        privateData = (fallbackPrivateRes.data ?? []) as ProfilePrivateRow[];
      }
    } else if (privateRes.error) {
      if (!isMissingTableError(privateRes.error as SupabaseErrorLike)) {
        console.error(privateRes.error);
        return NextResponse.json({ error: "Failed to fetch private profile data." }, { status: 500 });
      }
    } else {
      privateData = (privateRes.data ?? []) as ProfilePrivateRow[];
    }

    privateData.forEach((row) => {
      const profileId = row.profile_id?.trim();
      if (!profileId) return;
      privateMap.set(profileId, {
        studentId: normalizeStudentId(row.student_id),
        phoneNumber: row.phone_number?.trim() ?? "",
      });
    });

    const positionRes = await adminClient
      .from("profile_positions")
      .select("profile_id, position")
      .in("profile_id", targetProfileIds);

    if (positionRes.error) {
      if (!isMissingTableError(positionRes.error as SupabaseErrorLike)) {
        console.error(positionRes.error);
        return NextResponse.json({ error: "Failed to fetch profile positions." }, { status: 500 });
      }
    } else {
      ((positionRes.data ?? []) as PositionRow[]).forEach((row) => {
        const profileId = row.profile_id?.trim();
        const position = row.position?.trim();
        if (!profileId || !position) return;
        const bucket = roleMap.get(profileId) ?? [];
        if (!bucket.includes(position)) bucket.push(position);
        roleMap.set(profileId, bucket);
      });
    }
  }

  const allMemberEntries = buildEntriesFromIds(allMemberIds, nameMap, privateMap, roleMap);
  const eventMemberEntries = buildEntriesFromIds(eventMemberIds, nameMap, privateMap, roleMap);

  let templateBuffer: Buffer | null = null;
  let templateError: unknown = null;
  for (const templateName of rosterTemplateCandidates) {
    const filePath = path.join(process.cwd(), rosterDir, templateName);
    try {
      templateBuffer = await readFile(filePath);
      break;
    } catch (error) {
      templateError = error;
    }
  }
  if (!templateBuffer) {
    console.error(templateError);
    return NextResponse.json({ error: "Template file not found." }, { status: 404 });
  }

  let outputBuffer: Buffer;
  try {
    outputBuffer = await buildRosterWorkbook(templateBuffer, allMemberEntries, eventMemberEntries);
  } catch (error) {
    console.error(error);
    if (error instanceof Error && error.message.startsWith("Template capacity exceeded:")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to generate roster file." }, { status: 500 });
  }

  const eventName = ((eventData as EventRow).name ?? "event").trim() || "event";
  const safeEventName = sanitizeFileName(eventName) || "event";
  const asciiEventName = safeEventName.replace(/[^\x20-\x7E]/g, "").trim() || "event";
  const downloadFilename = `${asciiEventName}_member_roster.xlsx`;
  const downloadFilenameUtf8 = `${eventName}_\u69cb\u6210\u54e1\u540d\u7c3f.xlsx`;

  return new NextResponse(outputBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${downloadFilename}\"; filename*=UTF-8''${encodeURIComponent(
        downloadFilenameUtf8
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
