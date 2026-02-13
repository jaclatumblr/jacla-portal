export const formatTimeText = (value: string | null | undefined) => {
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length < 2) return value;
  const hours = parts[0].padStart(2, "0");
  const minutes = parts[1].padStart(2, "0");
  return `${hours}:${minutes}`;
};
