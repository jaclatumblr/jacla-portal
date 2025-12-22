const allowedDomain = "edu.teu.ac.jp";

const adminAllowlist = (process.env.NEXT_PUBLIC_ADMIN_EMAIL_ALLOWLIST ?? "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

export const emailPolicyMessage =
  "edu.teu.ac.jp のアカウントのみ利用できます。";

export function isAllowedEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith(`@${allowedDomain}`)) return true;
  return adminAllowlist.includes(normalized);
}
