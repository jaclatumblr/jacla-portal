export function isSafeInternalPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20\x7f]/.test(value)) return false;
  try { return new URL(value, "https://portal.invalid").origin === "https://portal.invalid"; } catch { return false; }
}

export function safeInternalPath(value: unknown, fallback = "/"): string {
  return isSafeInternalPath(value) ? value : fallback;
}
