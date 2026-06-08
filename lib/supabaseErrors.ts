type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

export function isMissingColumnError(
  error: SupabaseErrorLike | null | undefined,
  columnName?: string
) {
  if (!error) return false;

  const code = error.code ?? "";
  const text = `${error.message ?? ""} ${error.details ?? ""}`;

  if (code !== "42703" && code !== "PGRST204" && !/column .* does not exist/i.test(text)) {
    return false;
  }

  if (!columnName) return true;
  return text.includes(columnName);
}
