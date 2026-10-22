import { createHmac, timingSafeEqual } from "crypto";
export const discordStateCookie = "jacla_discord_state";
export const discordCookieOptions = { httpOnly: true, sameSite: "lax" as const, path: "/auth/discord/callback", maxAge: 600 };
type ConnectPayload = { sub: string; sid: string; next: string; iat: number; nonce: string };
export function verifyDiscordState(state: string, secret: string): ConnectPayload | null {
  if (state.length > 3800) return null;
  const parts = state.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return null;
  const expected = createHmac("sha256", secret).update(parts[0]).digest("base64url");
  if (!timingSafeEqual(Buffer.from(parts[1]), Buffer.from(expected))) return null;
  try {
    const value = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!value || typeof value !== "object" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.sub) || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.sid) || typeof value.next !== "string" || !/^[0-9a-f]{64}$/.test(value.nonce) || !Number.isFinite(value.iat) || value.iat > Date.now() || Date.now() - value.iat > 600000) return null;
    return value;
  } catch { return null; }
}
