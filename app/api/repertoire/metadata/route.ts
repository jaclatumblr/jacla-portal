import { NextResponse } from "next/server";

type MetadataResponse = {
  title: string | null;
  artist: string | null;
  source: string | null;
  duration_sec: number | null;
};

const providerConfigs = [
  {
    name: "youtube",
    test: (host: string) => host.includes("youtube.com") || host === "youtu.be",
    oembed: (url: string) =>
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  },
  {
    name: "spotify",
    test: (host: string) => host.includes("open.spotify.com"),
    oembed: (url: string) =>
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
  },
  {
    name: "apple-music",
    test: (host: string) => host.includes("music.apple.com"),
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
  /^::1$/,
];

const isPrivateHost = (host: string) =>
  privateHostPatterns.some((pattern) => pattern.test(host));

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

const fetchHtml = async (url: string) => {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status}`);
  }
  return res.text();
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
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`oEmbed failed: ${res.status}`);
  }
  const data = (await res.json()) as {
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
