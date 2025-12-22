const allowedDomain = "edu.teu.ac.jp";

const adminAllowlist = parseAllowlist(process.env.NEXT_PUBLIC_ADMIN_EMAIL_ALLOWLIST);

export const emailPolicyMessage =
  "edu.teu.ac.jp のアカウントのみ利用できます。";

type SupabaseUser = {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  identities?: Array<{ identity_data?: Record<string, unknown> | null }>;
} | null;

export function isAllowedEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith(`@${allowedDomain}`)) return true;
  return adminAllowlist.includes(normalized);
}

export function getUserEmail(user?: SupabaseUser): string | null {
  if (!user) return null;
  const direct = pickEmail(user.email);
  if (direct) return direct;
  const meta = user.user_metadata ?? {};
  const metaEmail =
    pickEmail(meta.email) ||
    pickEmail(meta.preferred_email) ||
    pickEmail(meta.email_address);
  if (metaEmail) return metaEmail;
  const identities = user.identities ?? [];
  for (const identity of identities) {
    const data = identity.identity_data ?? {};
    const identityEmail =
      pickEmail(data.email) ||
      pickEmail(data.preferred_email) ||
      pickEmail(data.email_address);
    if (identityEmail) return identityEmail;
  }
  return null;
}

function parseAllowlist(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,\u3001\uff0c]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function pickEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
