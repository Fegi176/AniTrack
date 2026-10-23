export type Status =
  "Watching" | "Completed" | "PlanToWatch" | "OnHold" | "Dropped";
export const statuses: Status[] = [
  "Watching",
  "Completed",
  "PlanToWatch",
  "OnHold",
  "Dropped",
];
export const statusLabels: Record<Status, string> = {
  Watching: "Watching",
  Completed: "Completed",
  PlanToWatch: "Plan to watch",
  OnHold: "On hold",
  Dropped: "Dropped",
};
export interface Anime {
  id: number;
  title: string;
  originalTitle: string;
  synopsis: string;
  posterUrl: string;
  genres: string[];
  studio: string;
  format: string;
  year: number;
  episodes: number;
  episodeMinutes: number;
  communityScore: number;
  airing: boolean;
  sourceUrl: string;
}
export interface User {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  createdAt: string;
  isDemo: boolean;
  avatarUrl: string | null;
}
export interface Entry {
  animeId: number;
  anime: Anime;
  status: Status;
  episodesWatched: number;
  score: number | null;
  notes: string;
  revision: string;
  updatedAt: string;
}
export interface EntryInput {
  status: Status;
  episodesWatched: number;
  score: number | null;
  notes: string;
  revision: string | null;
}
export interface Catalog {
  items: Anime[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export interface CatalogInfo {
  titleCount: number;
  sourceName: string;
  sourceUrl: string;
  lastUpdated: string;
  licenseUrl: string;
}
export interface Filters {
  genres: string[];
  formats: string[];
  years: number[];
}
export interface Insights {
  totalTitles: number;
  episodesWatched: number;
  hoursWatched: number;
  unknownRuntimeTitles: number;
  meanScore: number | null;
  statuses: { status: Status; count: number }[];
  genres: { name: string; count: number }[];
  ratings: { score: number; count: number }[];
  recent: Entry[];
}
