type SchemaError = { code?: string | null; message?: string | null; details?: string | null };

export function isMissingPortalAccounts(error: SchemaError | null | undefined): boolean {
  return Boolean(error && ["PGRST205", "42P01"].includes(error.code ?? "")
    && /\bportal_accounts\b/.test(`${error.message ?? ""} ${error.details ?? ""}`));
}

export function isMissingPortalAccessFunction(error: SchemaError | null | undefined): boolean {
  return Boolean(error?.code === "PGRST202"
    && /\bportal_user_has_access\b/.test(`${error.message ?? ""} ${error.details ?? ""}`));
}
