import { createContext, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Anime, Entry, EntryInput, User } from "./types";

export interface AppState {
  user: User | null;
  entries: Entry[];
  libraryPending: boolean;
  libraryError: Error | null;
  sessionPending: boolean;
  openAuth: () => void;
  detail: (anime: Anime) => void;
  edit: (anime: Anime) => void;
  notify: (message: string, kind?: "success" | "error") => void;
}
export const AppContext = createContext<AppState>(null!);
export const useApp = () => useContext(AppContext);
export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";
export const entryInput = (entry?: Entry): EntryInput => ({
  status: entry?.status ?? "PlanToWatch",
  episodesWatched: entry?.episodesWatched ?? 0,
  score: entry?.score ?? null,
  notes: entry?.notes ?? "",
  revision: entry?.revision ?? null,
});
export function useRefreshLibrary() {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["library"] }),
      client.invalidateQueries({ queryKey: ["insights"] }),
      client.invalidateQueries({ queryKey: ["history"] }),
      client.invalidateQueries({ queryKey: ["achievements"] }),
    ]);
  };
}
