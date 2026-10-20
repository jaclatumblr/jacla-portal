const allowedDomain = "edu.teu.ac.jp";

const adminAllowlist = parseAllowlist(process.env.NEXT_PUBLIC_ADMIN_EMAIL_ALLOWLIST);

export const emailPolicyMessage =
  "edu.teu.ac.jp のアカウント、または連携済みの個人Gmailのみ利用できます。";

type SupabaseUser = {
  email?: string | null;
  identities?: Array<{
    provider?: string;
    identity_data?: Record<string, unknown> | null;
  }>;
} | null;

export function isAllowedEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith(`@${allowedDomain}`)) return true;
  return adminAllowlist.includes(normalized);
}

export function hasAllowedEmail(user?: SupabaseUser): boolean {
  return getUserEmails(user).some((email) => isAllowedEmail(email));
}

export function isGmailAddress(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized.endsWith("@gmail.com") ||
    normalized.endsWith("@googlemail.com")
  );
}

export function getUserEmail(user?: SupabaseUser): string | null {
  return getUserEmails(user)[0] ?? null;
}

export function getUserEmails(user?: SupabaseUser): string[] {
  if (!user) return [];
  const emails: string[] = [];

  const addEmail = (value: unknown) => {
    const email = pickEmail(value);
    if (!email) return;
    const normalized = email.toLowerCase();
    if (emails.some((entry) => entry.toLowerCase() === normalized)) return;
    emails.push(email);
  };

  const direct = pickEmail(user.email);
  if (direct) addEmail(direct);

  const identities = user.identities ?? [];
  for (const identity of identities) {
    const data = identity.identity_data ?? {};
    if (data.email_verified === false || data.verified === false) continue;
    addEmail(data.email);
    addEmail(data.preferred_email);
    addEmail(data.email_address);
  }

  return emails;
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
