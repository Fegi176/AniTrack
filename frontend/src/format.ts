export const number = (value: number) => value.toLocaleString("en-US");
export const counted = (
  value: number,
  singular: string,
  plural = `${singular}s`,
) => `${number(value)} ${value === 1 ? singular : plural}`;
export const releaseYear = (year: number) =>
  year > 0 ? String(year) : "Year unknown";
export const episodeCount = (episodes: number) =>
  episodes > 0 ? counted(episodes, "episode") : "Episode count unknown";
export const snapshotDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
export function positiveInteger(value: string | null, fallback = 1) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2147483647
    ? parsed
    : fallback;
}
