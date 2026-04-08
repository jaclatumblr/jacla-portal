import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";
import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFPage,
  rgb,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  defaultVoxSetlistLayout,
  normalizeVoxSetlistLayout,
  type CustomLayer,
  type VoxSetlistLayout,
} from "@/lib/voxSetlistLayout";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const templateCandidates = ["Match Voxsetlist20250118.pdf"];
const docsDir = "資料";
const maxSongsPerBand = 10;

const fontCandidates = [
  "C:/Windows/Fonts/GOTHIC.TTF",
  "C:/Windows/Fonts/NotoSansJP-VF.ttf",
  path.join(process.cwd(), docsDir, "NotoSansJP-VF.ttf"),
  path.join(process.cwd(), docsDir, "NotoSansJP-Regular.ttf"),
];

type SupabaseErrorLike = { code?: string | null; message?: string | null };
type LeaderRow = { leader?: string | null };
type ProfileRow = { leader?: string | null };
type EventRow = { name?: string | null; date?: string | null };
type BandRow = { id?: string | null; name?: string | null; created_at?: string | null };
type SlotRow = {
  band_id?: string | null;
  slot_type?: "band" | "break" | "mc" | "other" | null;
  slot_phase?: "show" | "rehearsal_normal" | "rehearsal_pre" | null;
  order_in_event?: number | null;
  start_time?: string | null;
  end_time?: string | null;
};
type SongRow = {
  band_id?: string | null;
  title?: string | null;
  artist?: string | null;
  entry_type?: string | null;
  duration_sec?: number | null;
  order_index?: number | null;
  memo?: string | null;
  lighting_spot?: string | null;
  lighting_strobe?: string | null;
  lighting_moving?: string | null;
  lighting_color?: string | null;
};

type BandMemberRow = {
  band_id?: string | null;
  instrument?: string | null;
  position_x?: number | null;
  position_y?: number | null;
  order_index?: number | null;
  is_mc?: boolean | null;
  profiles?:
    | {
        display_name?: string | null;
        real_name?: string | null;
        part?: string | null;
      }
    | Array<{
        display_name?: string | null;
        real_name?: string | null;
        part?: string | null;
      }>
    | null;
};

type StagePlotItem = {
  label?: string | null;
  x?: number | null;
  y?: number | null;
};

type PreparedBand = {
  id: string;
  name: string;
  appearanceOrder: number | null;
  appearanceTotal: number;
  plannedStartTime: string;
  soundNote: string;
  lightingNote: string;
  stagePlotSummary: string;
  stagePlotItems: Array<{ label: string; x: number; y: number }>;
  memberPlotItems: Array<{ label: string; x: number; y: number }>;
  songs: Array<{
    title: string;
    paNote: string;
    lightingNote: string;
    entryType: "song" | "mc";
    durationSec: number | null;
    orderIndex: number;
  }>;
};

const isAdminLeader = (leader?: string | null) =>
  leader === "Administrator" || leader === "Supervisor";

const sanitizeFileName = (value: string) =>
  value.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();

const formatDuration = (durationSec: number | null) => {
  if (durationSec == null || durationSec < 0) return "";
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatEventDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
};

const formatTimeHHMM = (value: string | null | undefined) => {
  if (!value) return "";
  const [hRaw = "", mRaw = ""] = value.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  return `${h}:${String(m).padStart(2, "0")}`;
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

const loadFirstExistingBuffer = async (fileCandidates: string[]) => {
  let foundError: unknown = null;
  for (const candidate of fileCandidates) {
    const targetPath = candidate.includes(":")
      ? candidate
      : path.join(process.cwd(), docsDir, candidate);
    try {
      return await readFile(targetPath);
    } catch (error) {
      foundError = error;
    }
  }
  throw foundError ?? new Error("File not found.");
};

const maybeInflatePdfStream = (streamBuffer: Buffer, dictText: string) => {
  if (!/\/Filter\s*\/FlateDecode/.test(dictText)) {
    return streamBuffer;
  }

  try {
    return inflateSync(streamBuffer);
  } catch {
    let end = streamBuffer.length;
    while (end > 0) {
      const current = streamBuffer[end - 1];
      if (current !== 0x0a && current !== 0x0d && current !== 0x20 && current !== 0x09) {
        break;
      }
      end -= 1;
    }
    return inflateSync(streamBuffer.subarray(0, end));
  }
};

const extractEmbeddedFontCandidates = (templateBuffer: Buffer) => {
  const source = templateBuffer.toString("latin1");
  const fontFileRefs: number[] = [];
  const fontRefRegex = /\/FontFile2\s+(\d+)\s+0\s+R/g;
  let fontRefMatch: RegExpExecArray | null;
  while ((fontRefMatch = fontRefRegex.exec(source)) !== null) {
    const refNumber = Number.parseInt(fontRefMatch[1], 10);
    if (!Number.isNaN(refNumber)) {
      fontFileRefs.push(refNumber);
    }
  }

  const uniqueRefs = Array.from(new Set(fontFileRefs));
  const extracted: Buffer[] = [];

  for (const ref of uniqueRefs) {
    const objectToken = `${ref} 0 obj`;
    const objectStart = source.indexOf(objectToken);
    if (objectStart < 0) continue;
    const objectEnd = source.indexOf("endobj", objectStart);
    if (objectEnd < 0) continue;

    const objectText = source.slice(objectStart, objectEnd);
    if (!/stream/.test(objectText)) continue;

    const streamStartMatch = /<<([\s\S]*?)>>\s*stream\r?\n/.exec(objectText);
    if (!streamStartMatch) continue;

    const localStart = streamStartMatch.index + streamStartMatch[0].length;
    const absoluteStreamStart = objectStart + localStart;
    const absoluteStreamEnd = source.indexOf("endstream", absoluteStreamStart);
    if (absoluteStreamEnd < 0) continue;

    const rawStream = templateBuffer.subarray(absoluteStreamStart, absoluteStreamEnd);
    try {
      const decoded = maybeInflatePdfStream(rawStream, streamStartMatch[1] ?? "");
      if (decoded.length > 0) {
        extracted.push(decoded);
      }
    } catch {
      // Keep trying other embedded font streams.
    }
  }

  return extracted;
};

const embedBestFont = async (outputDoc: PDFDocument, templateBuffer: Buffer) => {
  outputDoc.registerFontkit(fontkit);

  const hasUsableJapaneseGlyphs = (font: PDFFont) => {
    const extractChunks = (encoded: string) => {
      const hex = encoded.replace(/^</, "").replace(/>$/, "");
      if (!hex || hex.length % 4 !== 0) return [] as string[];
      const chunks: string[] = [];
      for (let i = 0; i < hex.length; i += 4) {
        chunks.push(hex.slice(i, i + 4).toUpperCase());
      }
      return chunks;
    };

    const isMeaningful = (text: string) => {
      const encoded = font.encodeText(text).toString();
      const chunks = extractChunks(encoded);
      if (chunks.length === 0) return false;
      const nonZero = chunks.filter((chunk) => chunk !== "0000");
      if (nonZero.length === 0) return false;
      return new Set(nonZero).size >= 2;
    };

    try {
      font.encodeText("ABC123");
      return isMeaningful("日本語") && isMeaningful("漢字かなカナ");
    } catch {
      return false;
    }
  };

  for (const candidate of fontCandidates) {
    try {
      const fileBuffer = await readFile(candidate);
      const embedded = await outputDoc.embedFont(fileBuffer, { subset: false });
      if (hasUsableJapaneseGlyphs(embedded)) {
        return embedded;
      }
    } catch {
      // Try the next local/system font candidate.
    }
  }

  const embedded = extractEmbeddedFontCandidates(templateBuffer);
  for (const fontBuffer of embedded) {
    try {
      const extracted = await outputDoc.embedFont(fontBuffer, { subset: false });
      if (hasUsableJapaneseGlyphs(extracted)) {
        return extracted;
      }
    } catch {
      // Continue until a compatible embedded font is found.
    }
  }

  return outputDoc.embedFont(StandardFonts.Helvetica);
};

const toAsciiFallback = (text: string) => text.replace(/[^\x20-\x7E]/g, "").trim();

const encodeSafeText = (font: PDFFont, rawText: string) => {
  const text = rawText.trim();
  if (!text) return "";
  try {
    font.encodeText(text);
    return text;
  } catch {
    const ascii = toAsciiFallback(text);
    if (!ascii) return "";
    try {
      font.encodeText(ascii);
      return ascii;
    } catch {
      return "";
    }
  }
};

const fitText = (font: PDFFont, rawText: string, fontSize: number, maxWidth: number) => {
  const cleaned = rawText.replace(/\r?\n/g, " ").trim();
  if (!cleaned) return "";

  const source = encodeSafeText(font, cleaned);
  if (!source) return "";

  let text = source;
  while (text.length > 0 && font.widthOfTextAtSize(text, fontSize) > maxWidth) {
    text = text.slice(0, -1);
  }
  if (text.length < source.length && text.length > 1) {
    const ellipsis = "...";
    let result = text;
    while (result.length > 0 && font.widthOfTextAtSize(`${result}${ellipsis}`, fontSize) > maxWidth) {
      result = result.slice(0, -1);
    }
    return result.length > 0 ? `${result}${ellipsis}` : "";
  }
  return text;
};

const drawTextInCell = (
  page: PDFPage,
  font: PDFFont,
  text: string,
  options: {
    x: number;
    y: number;
    maxWidth: number;
    size?: number;
    align?: "left" | "center" | "right";
  }
) => {
  const size = options.size ?? 10;
  const fitted = fitText(font, text, size, options.maxWidth);
  if (!fitted) return;
  const textWidth = font.widthOfTextAtSize(fitted, size);
  let drawX = options.x;
  if (options.align === "center") {
    drawX = options.x + (options.maxWidth - textWidth) / 2;
  }
  if (options.align === "right") {
    drawX = options.x + options.maxWidth - textWidth;
  }
  page.drawText(fitted, {
    x: drawX,
    y: options.y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
};

const parseHexColor = (value: string | undefined) => {
  const hex = (value ?? "#000000").trim().replace(/^#/, "");
  const six = hex.length === 3 ? hex.split("").map((c) => `${c}${c}`).join("") : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(six)) return rgb(0, 0, 0);
  const r = Number.parseInt(six.slice(0, 2), 16) / 255;
  const g = Number.parseInt(six.slice(2, 4), 16) / 255;
  const b = Number.parseInt(six.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
};

const drawCustomLayers = (
  page: PDFPage,
  font: PDFFont,
  layout: VoxSetlistLayout
) => {
  for (const layer of layout.customLayers) {
    if (layer.visible === false) continue;
    const color = parseHexColor(layer.color);
    if (layer.type === "text") {
      drawTextInCell(page, font, layer.text ?? "", {
        x: layer.x,
        y: layer.y,
        maxWidth: layer.width ?? 120,
        size: layer.size ?? 10,
      });
      continue;
    }
    if (layer.type === "rect") {
      page.drawRectangle({
        x: layer.x,
        y: layer.y,
        width: Math.max(1, layer.width ?? 20),
        height: Math.max(1, layer.height ?? 10),
        borderWidth: 1,
        borderColor: color,
      });
      continue;
    }
    if (layer.type === "circle") {
      page.drawCircle({
        x: layer.x,
        y: layer.y,
        size: Math.max(1, layer.radius ?? 6),
        color,
      });
    }
  }
};

const formatLightingChoice = (value: string | null | undefined) => {
  if (!value) return "";
  if (value === "o") return "spot:on";
  if (value === "x") return "spot:off";
  if (value === "auto") return "spot:auto";
  return value;
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const parseStagePlotItems = (raw: unknown) => {
  if (!raw || typeof raw !== "object") return [] as Array<{ label: string; x: number; y: number }>;

  const record = raw as { items?: unknown };
  if (!Array.isArray(record.items)) return [] as Array<{ label: string; x: number; y: number }>;

  return (record.items as StagePlotItem[])
    .map((item) => {
      const label = (item?.label ?? "").trim();
      if (!label) return null;
      const x = clampPercent(Number(item?.x ?? 50));
      const y = clampPercent(Number(item?.y ?? 50));
      return { label, x, y };
    })
    .filter((item): item is { label: string; x: number; y: number } => Boolean(item));
};

const toMemberPlotItems = (rows: BandMemberRow[]) => {
  return rows
    .map((row, index) => {
      const bandId = (row.band_id ?? "").trim();
      if (!bandId) return null;

      const profile = Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : (row.profiles ?? null);
      const name = (profile?.real_name ?? profile?.display_name ?? "").trim();
      const labelBase = (row.instrument ?? profile?.part ?? "").trim();
      const label = (labelBase || name || `member${index + 1}`).slice(0, 12);
      const x = clampPercent(Number(row.position_x ?? 50));
      const y = clampPercent(Number(row.position_y ?? 50));

      return { bandId, point: { label, x, y }, order: row.order_index ?? Number.MAX_SAFE_INTEGER };
    })
    .filter(
      (
        entry
      ): entry is { bandId: string; point: { label: string; x: number; y: number }; order: number } =>
        Boolean(entry)
    )
    .sort((a, b) => a.order - b.order);
};

const parseStagePlotSummary = (raw: unknown) => {
  const labels = parseStagePlotItems(raw).map((item) => item.label);

  if (labels.length === 0) return "";
  if (labels.length <= 12) return labels.join(" / ");
  return `${labels.slice(0, 12).join(" / ")} ... (+${labels.length - 12})`;
};

const drawBandNotes = (
  page: PDFPage,
  font: PDFFont,
  layout: VoxSetlistLayout,
  lightingNote: string,
  soundNote: string,
  stageSummary: string
) => {
  drawTextInCell(page, font, `照明要望: ${lightingNote || "-"}`, {
    ...layout.notes.lighting,
  });
  drawTextInCell(page, font, `PA要望: ${soundNote || "-"}`, {
    ...layout.notes.pa,
  });
  drawTextInCell(page, font, `セット図: ${stageSummary || "-"}`, {
    ...layout.notes.stageSummary,
  });
};

const drawBandPage = (
  page: PDFPage,
  font: PDFFont,
  layout: VoxSetlistLayout,
  eventName: string,
  eventDate: string,
  band: PreparedBand,
  pageIndex: number,
  totalPages: number
) => {
  const songs = band.songs
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .slice(0, maxSongsPerBand);

  const totalSec = songs.reduce((sum, song) => sum + (song.durationSec ?? 0), 0);
  const totalDuration = formatDuration(totalSec);

  // Keep template visual style by avoiding broad white overlays.

  // The coordinates are tuned to the Match Vox setlist template.
  if (layout.showEventName) {
    drawTextInCell(page, font, eventName, { ...layout.fields.eventName });
  }
  drawTextInCell(page, font, eventDate, { ...layout.fields.eventDate });

  drawTextInCell(page, font, band.name, { ...layout.fields.bandName });
  const orderText =
    band.appearanceOrder != null
      ? `${band.appearanceOrder}/${Math.max(1, band.appearanceTotal)}`
      : `${pageIndex}/${totalPages}`;
  drawTextInCell(page, font, orderText, { ...layout.fields.pageLabel });
  drawTextInCell(page, font, String(band.appearanceOrder ?? pageIndex), { ...layout.fields.setOrder });
  drawTextInCell(page, font, totalDuration, { ...layout.fields.totalDuration });
  drawTextInCell(page, font, band.plannedStartTime, { ...layout.fields.plannedStartTime });

  const rowY = [383, 358, 334, 309, 284, 259, 235, 210, 186, 162];
  songs.forEach((song, index) => {
    const y = rowY[index];
    drawTextInCell(page, font, String(index + 1), {
      x: 31,
      y,
      maxWidth: 52,
      size: 10,
      align: "center",
    });
    drawTextInCell(page, font, song.title || (song.entryType === "mc" ? "MC" : ""), {
      x: 86,
      y,
      maxWidth: 112,
      size: 10,
    });
    drawTextInCell(page, font, song.lightingNote, {
      x: 204,
      y,
      maxWidth: 160,
      size: 9,
    });
    drawTextInCell(page, font, song.paNote, {
      x: 366,
      y,
      maxWidth: 135,
      size: 9,
    });
    drawTextInCell(page, font, formatDuration(song.durationSec), {
      x: 504,
      y,
      maxWidth: 58,
      size: 10,
      align: "center",
    });
  });

  if (band.songs.length > maxSongsPerBand) {
    drawTextInCell(page, font, `+${band.songs.length - maxSongsPerBand}曲`, {
      x: 370,
      y: 141,
      maxWidth: 190,
      size: 9,
      align: "right",
    });
  }

  drawBandNotes(
    page,
    font,
    layout,
    band.lightingNote,
    band.soundNote,
    band.stagePlotSummary
  );

  // Draw user-defined overlay layers on top of everything.
  drawCustomLayers(page, font, layout);
};

const buildPdf = async (
  templateBuffer: Buffer,
  layout: VoxSetlistLayout,
  eventName: string,
  eventDate: string,
  bands: PreparedBand[]
) => {
  const templateDoc = await PDFDocument.load(templateBuffer);
  const outputDoc = await PDFDocument.create();
  const font: PDFFont = await embedBestFont(outputDoc, templateBuffer);
  const templateBasePage = templateDoc.getPage(0);
  const { width: templateWidth, height: templateHeight } = templateBasePage.getSize();
  const embeddedTemplatePage = await outputDoc.embedPage(templateBasePage);

  const createPageWithTemplate = () => {
    const page = outputDoc.addPage([templateWidth, templateHeight]);
    page.drawPage(embeddedTemplatePage, {
      x: 0,
      y: 0,
      width: templateWidth,
      height: templateHeight,
    });
    return page;
  };

  const totalPages = Math.max(1, bands.length);
  if (bands.length === 0) {
    const page = createPageWithTemplate();
    drawTextInCell(page, font, eventName, {
      x: 90,
      y: 730,
      maxWidth: 300,
      size: 11,
    });
    drawTextInCell(page, font, eventDate, {
      x: 430,
      y: 730,
      maxWidth: 120,
      size: 10,
      align: "right",
    });
    drawTextInCell(page, font, "バンドが見つかりません。", {
      x: 90,
      y: 687,
      maxWidth: 340,
      size: 11,
    });
  } else {
    for (let index = 0; index < bands.length; index += 1) {
      const page = createPageWithTemplate();
      drawBandPage(page, font, layout, eventName, eventDate, bands[index], index + 1, totalPages);
    }
  }

  return Buffer.from(await outputDoc.save());
};

const buildTemplatePreviewPdf = async (templateBuffer: Buffer) => {
  const templateDoc = await PDFDocument.load(templateBuffer);
  const outputDoc = await PDFDocument.create();
  const [firstPage] = await outputDoc.copyPages(templateDoc, [0]);
  outputDoc.addPage(firstPage);
  return Buffer.from(await outputDoc.save());
};

export async function GET(request: Request) {
  return handleRequest(request, "GET");
}

export async function POST(request: Request) {
  return handleRequest(request, "POST");
}

async function handleRequest(request: Request, method: "GET" | "POST") {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Server configuration missing (Supabase keys)." },
      { status: 500 }
    );
  }

  let requestLayout: unknown = null;
  const searchParams = new URL(request.url).searchParams;
  let eventId = searchParams.get("eventId")?.trim() ?? "";
  const previewMode = (searchParams.get("preview") ?? "").trim().toLowerCase();
  if (method === "POST") {
    try {
      const body = (await request.json()) as { eventId?: string; layout?: unknown };
      eventId = (body.eventId ?? "").trim() || eventId;
      requestLayout = body.layout;
    } catch {
      // Ignore parse errors and keep query fallback.
    }
  }
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
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
    if (!isMissingTableError(leaderError as SupabaseErrorLike)) {
      console.error(leaderError);
      return NextResponse.json({ error: "Failed to verify permission." }, { status: 500 });
    }
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
      return NextResponse.json({ error: "Failed to verify permission." }, { status: 500 });
    }

    const fallbackLeader = (profileRow as ProfileRow | null)?.leader;
    if (fallbackLeader && fallbackLeader !== "none") {
      leaders = [fallbackLeader];
    }
  }

  if (!leaders.some(isAdminLeader)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: eventData, error: eventError } = await adminClient
    .from("events")
    .select("name, date")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError) {
    console.error(eventError);
    return NextResponse.json({ error: "Failed to fetch event." }, { status: 500 });
  }
  if (!eventData) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const { data: bandData, error: bandError } = await adminClient
    .from("bands")
    .select("id, name, created_at, sound_note, lighting_note, stage_plot_data")
    .eq("event_id", eventId)
    .eq("band_type", "event")
    .order("created_at", { ascending: true });

  if (bandError) {
    console.error(bandError);
    return NextResponse.json({ error: "Failed to fetch event bands." }, { status: 500 });
  }

  const bands = (bandData ?? [])
    .map((row) => ({
      id: (row as BandRow).id?.trim() ?? "",
      name: ((row as BandRow).name ?? "").trim() || "(untitled)",
      soundNote: ((row as BandRow & { sound_note?: string | null }).sound_note ?? "").trim(),
      lightingNote: ((row as BandRow & { lighting_note?: string | null }).lighting_note ?? "").trim(),
      stagePlotSummary: parseStagePlotSummary(
        (row as BandRow & { stage_plot_data?: unknown }).stage_plot_data ?? null
      ),
      stagePlotItems: parseStagePlotItems(
        (row as BandRow & { stage_plot_data?: unknown }).stage_plot_data ?? null
      ),
    }))
    .filter((row) => row.id.length > 0);

  const bandIds = bands.map((row) => row.id);

  let slotMetaByBand = new Map<
    string,
    { order: number | null; total: number; startTime: string }
  >();
  if (bandIds.length > 0) {
    const { data: slotData, error: slotError } = await adminClient
      .from("event_slots")
      .select("band_id, slot_type, slot_phase, order_in_event, start_time, end_time")
      .eq("event_id", eventId)
      .in("band_id", bandIds)
      .eq("slot_type", "band")
      .order("order_in_event", { ascending: true })
      .order("start_time", { ascending: true });

    if (slotError) {
      console.error(slotError);
      return NextResponse.json({ error: "Failed to fetch event slots." }, { status: 500 });
    }

    const typedSlots = (slotData ?? []) as SlotRow[];
    const showFirst = typedSlots
      .slice()
      .sort((a, b) => {
        const phaseA = a.slot_phase === "show" ? 0 : 1;
        const phaseB = b.slot_phase === "show" ? 0 : 1;
        if (phaseA !== phaseB) return phaseA - phaseB;
        const orderA = a.order_in_event ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.order_in_event ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return (a.start_time ?? "").localeCompare(b.start_time ?? "");
      });

    const picked = new Map<string, SlotRow>();
    for (const slot of showFirst) {
      const bandId = slot.band_id?.trim() ?? "";
      if (!bandId || picked.has(bandId)) continue;
      picked.set(bandId, slot);
    }

    const orderedPicked = Array.from(picked.entries()).sort((a, b) => {
      const orderA = a[1].order_in_event ?? Number.MAX_SAFE_INTEGER;
      const orderB = b[1].order_in_event ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return (a[1].start_time ?? "").localeCompare(b[1].start_time ?? "");
    });

    const total = orderedPicked.length;
    slotMetaByBand = orderedPicked.reduce<Map<string, { order: number | null; total: number; startTime: string }>>(
      (map, [bandId, slot], index) => {
        map.set(bandId, {
          order: slot.order_in_event ?? index + 1,
          total,
          startTime: formatTimeHHMM(slot.start_time ?? null),
        });
        return map;
      },
      new Map<string, { order: number | null; total: number; startTime: string }>()
    );
  }

  let songsByBand = new Map<string, PreparedBand["songs"]>();
  let memberPointsByBand = new Map<string, Array<{ label: string; x: number; y: number }>>();
  if (bandIds.length > 0) {
    const { data: songData, error: songError } = await adminClient
      .from("songs")
      .select(
        "band_id, title, artist, entry_type, duration_sec, order_index, memo, lighting_spot, lighting_strobe, lighting_moving, lighting_color"
      )
      .in("band_id", bandIds)
      .order("order_index", { ascending: true });

    if (songError) {
      console.error(songError);
      return NextResponse.json({ error: "Failed to fetch songs." }, { status: 500 });
    }

    songsByBand = (songData ?? []).reduce<Map<string, PreparedBand["songs"]>>((map, row) => {
      const typedRow = row as SongRow;
      const bandId = typedRow.band_id?.trim() ?? "";
      if (!bandId) return map;

      const bucket = map.get(bandId) ?? [];
      const entryType = typedRow.entry_type === "mc" ? "mc" : "song";
      const title = (typedRow.title ?? "").trim();
      const durationSec = typedRow.duration_sec ?? null;
      const paNote = (typedRow.memo ?? "").trim();
      const lightingParts = [
        formatLightingChoice(typedRow.lighting_spot),
        typedRow.lighting_strobe ? `strobe:${typedRow.lighting_strobe}` : "",
        typedRow.lighting_moving ? `moving:${typedRow.lighting_moving}` : "",
        typedRow.lighting_color ? `color:${typedRow.lighting_color}` : "",
      ].filter((part) => part.length > 0);
      const lightingNote = lightingParts.join(" ");
      const hasVisibleContent =
        title.length > 0 || paNote.length > 0 || lightingNote.length > 0 || durationSec != null;
      if (!hasVisibleContent) {
        return map;
      }

      bucket.push({
        title,
        paNote,
        lightingNote,
        entryType,
        durationSec,
        orderIndex: typedRow.order_index ?? Number.MAX_SAFE_INTEGER,
      });
      map.set(bandId, bucket);
      return map;
    }, new Map<string, PreparedBand["songs"]>());

    const { data: memberData, error: memberError } = await adminClient
      .from("band_members")
      .select(
        "band_id, instrument, position_x, position_y, order_index, is_mc, profiles(display_name, real_name, part)"
      )
      .in("band_id", bandIds)
      .order("order_index", { ascending: true });

    if (memberError) {
      console.error(memberError);
      return NextResponse.json({ error: "Failed to fetch band members." }, { status: 500 });
    }

    const flatMembers = toMemberPlotItems((memberData ?? []) as BandMemberRow[]);
    memberPointsByBand = flatMembers.reduce<
      Map<string, Array<{ label: string; x: number; y: number }>>
    >((map, entry) => {
      const current = map.get(entry.bandId) ?? [];
      current.push(entry.point);
      map.set(entry.bandId, current);
      return map;
    }, new Map<string, Array<{ label: string; x: number; y: number }>>());
  }

  const preparedBands: PreparedBand[] = bands.map((band) => ({
    id: band.id,
    name: band.name,
    appearanceOrder: slotMetaByBand.get(band.id)?.order ?? null,
    appearanceTotal: slotMetaByBand.get(band.id)?.total ?? bands.length,
    plannedStartTime: slotMetaByBand.get(band.id)?.startTime ?? "",
    soundNote: band.soundNote,
    lightingNote: band.lightingNote,
    stagePlotSummary: band.stagePlotSummary,
    stagePlotItems: band.stagePlotItems,
    memberPlotItems: memberPointsByBand.get(band.id) ?? [],
    songs: (songsByBand.get(band.id) ?? []).sort((a, b) => a.orderIndex - b.orderIndex),
  }));

  preparedBands.forEach((band, index) => {
    if (band.appearanceOrder == null) {
      band.appearanceOrder = index + 1;
    }
    if (!band.appearanceTotal || band.appearanceTotal < 1) {
      band.appearanceTotal = preparedBands.length;
    }
  });

  let templateBuffer: Buffer;
  try {
    templateBuffer = await loadFirstExistingBuffer(templateCandidates);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Template PDF not found." }, { status: 404 });
  }

  if (previewMode === "template") {
    try {
      const previewBuffer = await buildTemplatePreviewPdf(templateBuffer);
      return new NextResponse(new Uint8Array(previewBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "inline; filename=match_vox_template_preview.pdf",
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: "Failed to generate template preview PDF." }, { status: 500 });
    }
  }

  const eventName = ((eventData as EventRow).name ?? "event").trim() || "event";
  const eventDate = formatEventDate(((eventData as EventRow).date ?? "").trim());
  const layout = normalizeVoxSetlistLayout(requestLayout ?? defaultVoxSetlistLayout);

  let outputBuffer: Buffer;
  try {
    outputBuffer = await buildPdf(templateBuffer, layout, eventName, eventDate, preparedBands);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate PDF: ${message}` },
      { status: 500 }
    );
  }

  const safeEventName = sanitizeFileName(eventName) || "event";
  const asciiEventName = safeEventName.replace(/[^\x20-\x7E]/g, "").trim() || "event";
  const downloadFilename = `${asciiEventName}_match_vox_setlist.pdf`;
  const downloadFilenameUtf8 = `${eventName}_Match Vox setlist.pdf`;

  return new NextResponse(new Uint8Array(outputBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${downloadFilename}"; filename*=UTF-8''${encodeURIComponent(
        downloadFilenameUtf8
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
