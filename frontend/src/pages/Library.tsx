import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Plus, Search, Star } from "lucide-react";
import { useApp } from "../context";
import { statuses, statusLabels } from "../types";
import type { Status } from "../types";
import { counted, releaseYear } from "../format";
import {
  Empty,
  PageHeading,
  Poster,
  SignInPrompt,
  Skeletons,
} from "../components/ui";

export function Library() {
  const { user, entries, edit, libraryPending, libraryError } = useApp();
  const [params, setParams] = useSearchParams();
  const requestedStatus = params.get("status");
  const status = statuses.includes(requestedStatus as Status)
    ? requestedStatus!
    : "All";
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("updated");
  if (!user) return <SignInPrompt title="Make room for your favorites." />;
  const filtered = entries
    .filter(
      (e) =>
        (status === "All" || e.status === status) &&
        e.anime.title.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.anime.title.localeCompare(b.anime.title)
        : sort === "score"
          ? (b.score ?? 0) - (a.score ?? 0)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  return (
    <>
      <PageHeading
        eyebrow="YOUR WATCHLIST"
        title="Every story, in one place."
        text={`${counted(entries.length, "title")} saved. Watch at your own pace.`}
        action={
          <Link className="button primary" to="/discover">
            <Plus size={17} />
            Find more anime
          </Link>
        }
      />
      <div className="library-tabs" role="group" aria-label="Library status">
        {["All", ...statuses].map((value) => (
          <button
            key={value}
            className={status === value ? "selected" : ""}
            aria-pressed={status === value}
            onClick={() => setParams(value === "All" ? {} : { status: value })}
          >
            {value === "All" ? "All anime" : statusLabels[value as Status]}
            <span>
              {value === "All"
                ? entries.length
                : entries.filter((e) => e.status === value).length}
            </span>
          </button>
        ))}
      </div>
      <div
        className="library-toolbar"
        role="search"
        aria-label="Search your library"
      >
        <div className="inline-search">
          <Search size={17} />
          <input
            aria-label="Search your library"
            type="search"
            placeholder="Search your library…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          aria-label="Sort library"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="updated">Recently updated</option>
          <option value="title">Title A–Z</option>
          <option value="score">Your rating</option>
        </select>
      </div>
      {libraryPending ? (
        <Skeletons />
      ) : libraryError ? null : filtered.length ? (
        <div className="library-list">
          <div className="library-list-header">
            <span>THE STORY</span>
            <span>YOUR PROGRESS</span>
            <span>RATING</span>
            <span>STATUS</span>
          </div>
          {filtered.map((entry) => (
            <article key={entry.animeId} className="library-row">
              <button
                className="library-title"
                aria-label={`Edit ${entry.anime.title}`}
                onClick={() => edit(entry.anime)}
              >
                <Poster anime={entry.anime} decorative />
                <div>
                  <strong>{entry.anime.title}</strong>
                  <span>
                    {releaseYear(entry.anime.year)} · {entry.anime.format}
                    {entry.anime.studio ? ` · ${entry.anime.studio}` : ""}
                  </span>
                </div>
              </button>
              <div className="library-progress">
                <span>
                  {entry.episodesWatched}{" "}
                  <span className="muted">
                    /{" "}
                    {entry.anime.episodes
                      ? counted(entry.anime.episodes, "episode")
                      : "unknown total"}
                  </span>
                </span>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${entry.anime.episodes ? (entry.episodesWatched / entry.anime.episodes) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <span
                className="library-score"
                aria-label={
                  entry.score
                    ? `Your rating: ${entry.score} out of 10`
                    : "Not rated"
                }
              >
                <Star size={14} />
                {entry.score ?? "—"}
              </span>
              <button
                className={`status-badge status-${entry.status}`}
                aria-label={`Edit status for ${entry.anime.title}: ${statusLabels[entry.status]}`}
                onClick={() => edit(entry.anime)}
              >
                <span />
                {statusLabels[entry.status]}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            entries.length
              ? "Nothing on this shelf yet."
              : "Your first story is waiting."
          }
          text={
            entries.length
              ? "Try another status or search term."
              : "Explore the catalog and add a title to start your watchlist."
          }
          action={
            <Link to="/discover" className="button primary">
              Explore anime
              <ArrowRight size={16} />
            </Link>
          }
        />
      )}
    </>
  );
}
