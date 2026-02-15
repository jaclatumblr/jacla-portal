const MAX_PHONE_DIGITS = 11;

const splitByPattern = (digits: string, pattern: number[]) => {
  const parts: string[] = [];
  let index = 0;

  for (const size of pattern) {
    if (index >= digits.length) break;
    const end = Math.min(index + size, digits.length);
    parts.push(digits.slice(index, end));
    index = end;
  }

  if (index < digits.length) {
    parts.push(digits.slice(index));
  }

  return parts.join("-");
};

export const normalizePhoneDigits = (value: string | null | undefined) =>
  (value ?? "").replace(/\D/g, "").slice(0, MAX_PHONE_DIGITS);

export const formatPhoneNumber = (value: string | null | undefined) => {
  const digits = normalizePhoneDigits(value);
  if (!digits) return "";

  if (digits.startsWith("0120") || digits.startsWith("0800")) {
    return splitByPattern(digits, [4, 3, 3]);
  }

  if (digits.startsWith("03") || digits.startsWith("06")) {
    return splitByPattern(digits, [2, 4, 4]);
  }

  if (/^(050|070|080|090)/.test(digits)) {
    return splitByPattern(digits, [3, 4, 4]);
  }

  if (digits.length <= 10) {
    return splitByPattern(digits, [3, 3, 4]);
  }

  return splitByPattern(digits, [3, 4, 4]);
};
