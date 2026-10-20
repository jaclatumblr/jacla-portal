import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { lookup } from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";

type MetadataResponse = {
  title: string | null;
  artist: string | null;
  source: string | null;
  duration_sec: number | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const fetchTimeoutMs = 8_000;
const maxResponseBytes = 1_000_000;

const providerConfigs = [
  {
    name: "youtube",
    test: (host: string) =>
      isSameOrSubdomain(host, "youtube.com") || isSameOrSubdomain(host, "youtu.be"),
    oembed: (url: string) =>
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  },
  {
    name: "spotify",
    test: (host: string) => isSameOrSubdomain(host, "open.spotify.com"),
    oembed: (url: string) =>
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
  },
  {
    name: "apple-music",
    test: (host: string) => isSameOrSubdomain(host, "music.apple.com"),
    oembed: (url: string) =>
      `https://music.apple.com/oembed?url=${encodeURIComponent(url)}`,
  },
] as const;

const privateHostPatterns = [
  /^localhost$/i,
  /\.local$/i,
  /^127\./,
  /^10\./,
  /^0\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^::1$/,
  /^::$/,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe[89ab][0-9a-f]:/i,
  /^ff[0-9a-f]{2}:/i,
];

const normalizeHost = (host: string) =>
  host.toLowerCase().replace(/^\[(.*)\]$/, "$1").replace(/\.$/, "");

const isSameOrSubdomain = (host: string, domain: string) => {
  const normalizedHost = normalizeHost(host);
  const normalizedDomain = normalizeHost(domain);
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
};

const isPrivateIpv4 = (host: string) => {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => Number.parseInt(part, 10));
  if (
    octets.some(
      (octet, index) =>
        !/^\d+$/.test(parts[index]) || Number.isNaN(octet) || octet < 0 || octet > 255
    )
  ) {
    return false;
  }
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
};

const isPrivateIpv6 = (host: string) => {
  const normalized = normalizeHost(host);
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length));
  }
  return privateHostPatterns.some((pattern) => pattern.test(normalized));
};

const isPrivateHost = (host: string) => {
  const normalized = normalizeHost(host);
  if (privateHostPatterns.some((pattern) => pattern.test(normalized))) return true;
  if (isPrivateIpv4(normalized)) return true;
  if (net.isIP(normalized) === 6 && isPrivateIpv6(normalized)) return true;
  return false;
};

const assertPublicUrl = async (url: string) => {
  const parsed = new URL(url);
  const host = normalizeHost(parsed.hostname);
  if (isPrivateHost(host)) {
    throw new Error("Blocked host");
  }

  if (net.isIP(host)) return;

  const addresses = await lookup(host, { all: true });
  if (addresses.some((entry) => isPrivateHost(entry.address))) {
    throw new Error("Blocked host resolution");
  }
};

const parseMeta = (html: string, property: string) => {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const match = html.match(regex);
  return match ? match[1] : null;
};

const parseDurationSeconds = (raw: string | null) => {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  if (/^\d+$/.test(value)) {
    const seconds = Number.parseInt(value, 10);
    return Number.isNaN(seconds) ? null : seconds;
  }

  const timeMatch = value.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const hours = timeMatch[3] ? Number.parseInt(timeMatch[1], 10) : 0;
    const minutes = timeMatch[3]
      ? Number.parseInt(timeMatch[2], 10)
      : Number.parseInt(timeMatch[1], 10);
    const seconds = Number.parseInt(timeMatch[3] ?? timeMatch[2], 10);
    if ([hours, minutes, seconds].some((num) => Number.isNaN(num))) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }

  const isoMatch = value.match(
    /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i
  );
  if (isoMatch) {
    const hours = Number.parseInt(isoMatch[1] ?? "0", 10);
    const minutes = Number.parseInt(isoMatch[2] ?? "0", 10);
    const seconds = Number.parseInt(isoMatch[3] ?? "0", 10);
    if ([hours, minutes, seconds].some((num) => Number.isNaN(num))) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }

  const compactMatch = value.match(/^(?:(\d+)m)?\s*(?:(\d+)s)?$/i);
  if (compactMatch && (compactMatch[1] || compactMatch[2])) {
    const minutes = Number.parseInt(compactMatch[1] ?? "0", 10);
    const seconds = Number.parseInt(compactMatch[2] ?? "0", 10);
    if ([minutes, seconds].some((num) => Number.isNaN(num))) return null;
    return minutes * 60 + seconds;
  }

  return null;
};

const verifyAuthenticated = async (request: Request) => {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return false;

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  return !error && Boolean(data.user);
};

const fetchWithTimeout = async (url: string, init: RequestInit = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), fetchTimeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      redirect: "error",
    });
    const declaredSize = Number(res.headers.get("content-length"));
    if (Number.isFinite(declaredSize) && declaredSize > maxResponseBytes) {
      controller.abort();
      throw new Error("Response too large");
    }
    reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxResponseBytes) {
          controller.abort();
          throw new Error("Response too large");
        }
        chunks.push(value);
      }
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: res.ok, status: res.status, text: new TextDecoder().decode(body) };
  } finally {
    if (controller.signal.aborted) void reader?.cancel().catch(() => {});
    reader?.releaseLock();
    clearTimeout(timeoutId);
  }
};

const fetchHtml = async (url: string) => {
  await assertPublicUrl(url);
  const res = await fetchWithTimeout(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status}`);
  }
  return res.text;
};

const extractHtmlMetadata = (html: string) => {
  const title =
    parseMeta(html, "og:title") ??
    parseMeta(html, "twitter:title") ??
    parseMeta(html, "title");
  const artist =
    parseMeta(html, "music:musician") ??
    parseMeta(html, "artist") ??
    parseMeta(html, "author") ??
    parseMeta(html, "og:site_name");
  const durationRaw =
    parseMeta(html, "music:duration") ??
    parseMeta(html, "video:duration") ??
    parseMeta(html, "og:video:duration") ??
    parseMeta(html, "og:duration") ??
    parseMeta(html, "duration");
  return {
    title,
    artist,
    duration_sec: parseDurationSeconds(durationRaw),
  };
};

const extractYouTubeDuration = (html: string) => {
  const lengthMatch = html.match(/"lengthSeconds":"(\\d+)"/);
  if (lengthMatch) return parseDurationSeconds(lengthMatch[1]);
  const approxMatch = html.match(/"approxDurationMs":"(\\d+)"/);
  if (approxMatch) {
    const ms = Number.parseInt(approxMatch[1], 10);
    return Number.isNaN(ms) ? null : Math.round(ms / 1000);
  }
  return null;
};

const extractSpotifyDuration = (html: string) => {
  const match = html.match(/"duration_ms":(\\d+)/);
  if (!match) return null;
  const ms = Number.parseInt(match[1], 10);
  return Number.isNaN(ms) ? null : Math.round(ms / 1000);
};

const extractAppleMusicDuration = (html: string) => {
  const match =
    html.match(/"durationInMillis":(\\d+)/) ??
    html.match(/"durationInMs":(\\d+)/);
  if (match) {
    const ms = Number.parseInt(match[1], 10);
    return Number.isNaN(ms) ? null : Math.round(ms / 1000);
  }
  return null;
};

const mergeMetadata = (
  base: MetadataResponse | null,
  htmlMeta: { title: string | null; artist: string | null; duration_sec: number | null },
  durationOverride: number | null,
  source: string
): MetadataResponse => {
  return {
    title: base?.title ?? htmlMeta.title ?? null,
    artist: base?.artist ?? htmlMeta.artist ?? null,
    source,
    duration_sec:
      durationOverride ??
      base?.duration_sec ??
      htmlMeta.duration_sec ??
      null,
  };
};

const fetchOembed = async (url: string, source: string): Promise<MetadataResponse> => {
  await assertPublicUrl(url);
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    throw new Error(`oEmbed failed: ${res.status}`);
  }
  const data = JSON.parse(res.text) as {
    title?: string;
    author_name?: string;
    duration?: number | string;
    length_seconds?: number | string;
  };
  const durationRaw =
    typeof data.duration === "number" || typeof data.duration === "string"
      ? String(data.duration)
      : typeof data.length_seconds === "number" || typeof data.length_seconds === "string"
        ? String(data.length_seconds)
        : null;
  return {
    title: data.title ?? null,
    artist: data.author_name ?? null,
    source,
    duration_sec: parseDurationSeconds(durationRaw),
  };
};

const fetchOpenGraph = async (url: string): Promise<MetadataResponse> => {
  const html = await fetchHtml(url);
  const meta = extractHtmlMetadata(html);
  return {
    title: meta.title,
    artist: meta.artist,
    source: null,
    duration_sec: meta.duration_sec,
  };
};

export async function POST(request: Request) {
  if (!(await verifyAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { url?: string };
  const rawUrl = body.url?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
  }

  if (isPrivateHost(parsed.hostname)) {
    return NextResponse.json({ error: "Blocked host" }, { status: 400 });
  }

  const provider = providerConfigs.find((entry) => entry.test(parsed.hostname));
  if (provider) {
    let oembedData: MetadataResponse | null = null;
    try {
      oembedData = await fetchOembed(provider.oembed(parsed.toString()), provider.name);
    } catch {
      oembedData = null;
    }

    try {
      const html = await fetchHtml(parsed.toString());
      const htmlMeta = extractHtmlMetadata(html);
      const durationOverride =
        provider.name === "youtube"
          ? extractYouTubeDuration(html)
          : provider.name === "spotify"
          ? extractSpotifyDuration(html)
          : provider.name === "apple-music"
          ? extractAppleMusicDuration(html)
          : null;
      return NextResponse.json(
        mergeMetadata(oembedData, htmlMeta, durationOverride, provider.name)
      );
    } catch {
      if (oembedData) return NextResponse.json(oembedData);
    }
  }

  try {
    const data = await fetchOpenGraph(parsed.toString());
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      title: null,
      artist: null,
      source: null,
      duration_sec: null,
    });
  }
}
