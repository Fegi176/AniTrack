import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Clock3,
  LoaderCircle,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";
import { api } from "../api";
import { entryInput, errorText, useApp, useRefreshLibrary } from "../context";
import type { Catalog, Entry } from "../types";
import { number } from "../format";
import {
  AnimeCard,
  ErrorPanel,
  PageHeading,
  Poster,
  SectionHeading,
  Skeletons,
  Stat,
} from "../components/ui";

export function Overview() {
  const { user, entries, detail, edit, libraryPending, openAuth } = useApp();
  const catalog = useQuery({
    queryKey: ["catalog", "featured"],
    queryFn: () => api<Catalog>("/catalog?pageSize=6"),
  });
  const watching = entries.filter((entry) => entry.status === "Watching");
  const hero = catalog.data?.items[0];
  const completed = entries.filter(
    (entry) => entry.status === "Completed",
  ).length;
  const episodes = entries.reduce(
    (sum, entry) => sum + entry.episodesWatched,
    0,
  );
  return (
    <>
      <PageHeading
        eyebrow="THE NEXT CHAPTER"
        title={
          user
            ? `Welcome back, ${user.displayName}.`
            : "Your next favorite starts here."
        }
        text="Discover something new and keep your watchlist moving."
        action={
          <Link className="button secondary" to="/library">
            <BookOpen size={16} />
            My library
          </Link>
        }
      />
      <section className="hero" aria-label="Featured anime">
        <div className="hero-art" aria-hidden="true">
          {hero && <Poster anime={hero} eager />}
        </div>
        <div className="hero-grain" />
        <div className="hero-content">
          <span className="hero-label">
            <Sparkles size={14} />A STORY WORTH YOUR TIME
          </span>
          <h2>
            Get lost in a story.
            <br />
            <em>Find your next favorite.</em>
          </h2>
          <p>
            Some journeys begin after the adventure ends. Discover a world that
            stays with you, one episode at a time.
          </p>
          <div className="hero-actions">
            <button
              className="button primary"
              disabled={!hero}
              onClick={() => hero && detail(hero)}
            >
              <ArrowUpRight size={17} />
              Explore the story
            </button>
            <Link className="hero-browse" to="/discover">
              Browse all anime
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="hero-caption">
            {hero?.title ?? "Curated stories, your way"}
            <span>FEATURED PICK / 01</span>
          </div>
        </div>
      </section>
      {user ? (
        <div className="stat-strip">
          <Stat
            icon={<BookOpen size={18} />}
            value={libraryPending ? "—" : number(entries.length)}
            label="In your library"
          />
          <Stat
            icon={<Play size={18} />}
            value={libraryPending ? "—" : number(watching.length)}
            label="Currently watching"
          />
          <Stat
            icon={<Check size={18} />}
            value={libraryPending ? "—" : number(completed)}
            label="Stories completed"
          />
          <Stat
            icon={<Clock3 size={18} />}
            value={libraryPending ? "—" : number(episodes)}
            label="Episodes watched"
          />
        </div>
      ) : (
        <div className="guest-invite">
          <span className="stat-icon">
            <BookOpen size={21} />
          </span>
          <div>
            <h3>Your watchlist starts with one title.</h3>
            <p>Save anime, track episodes, and pick up where you left off.</p>
          </div>
          <button className="button secondary" onClick={openAuth}>
            Start your list
            <ArrowRight size={17} />
          </button>
        </div>
      )}
      {user && (watching.length > 0 || libraryPending) && (
        <section className="section">
          <SectionHeading
            title="Pick up where you left off"
            subtitle="Your next episode is waiting."
            link="View library"
            to="/library?status=Watching"
          />
          <div className="continue-grid">
            {watching.slice(0, 3).map((entry) => (
              <ContinueCard
                key={entry.animeId}
                entry={entry}
                edit={() => edit(entry.anime)}
              />
            ))}
            {libraryPending && <p className="muted">Loading your watchlist…</p>}
          </div>
        </section>
      )}
      <section className="section">
        <SectionHeading
          title="Stories worth exploring"
          subtitle="A few featured picks to start your next chapter."
          link="Explore the catalog"
          to="/discover"
        />
        {catalog.isPending ? (
          <Skeletons />
        ) : catalog.isError ? (
          <ErrorPanel
            error={catalog.error}
            retry={() => void catalog.refetch()}
          />
        ) : (
          <div className="anime-grid">
            {catalog.data.items.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        )}
      </section>
      <div className="editorial-note">
        <span>✳</span>
        <div>
          <h3>Your taste. Your pace. Your space.</h3>
          <p>No endless feed. Just the stories you want to remember.</p>
        </div>
        <Link
          to="/discover"
          className="icon-button"
          aria-label="Discover more anime"
        >
          <ArrowUpRight size={25} />
        </Link>
      </div>
    </>
  );
}
function ContinueCard({ entry, edit }: { entry: Entry; edit: () => void }) {
  const { notify } = useApp();
  const refresh = useRefreshLibrary();
  const increment = useMutation({
    mutationFn: () =>
      api<Entry>(`/library/${entry.animeId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...entryInput(entry),
          episodesWatched: entry.episodesWatched + 1,
        }),
      }),
    onSuccess: async (updated) => {
      await refresh();
      notify(
        updated.status === "Completed"
          ? `Marked ${entry.anime.title} as completed.`
          : "Episode saved. Your progress is up to date.",
      );
    },
    onError: (error) => notify(errorText(error), "error"),
  });
  return (
    <article className="continue-card">
      <button
        className="continue-poster"
        onClick={edit}
        aria-label={`Edit ${entry.anime.title}`}
      >
        <Poster anime={entry.anime} />
      </button>
      <div>
        <span className="eyebrow">
          {entry.anime.format === "TV" ? "TV SERIES" : entry.anime.format}
        </span>
        <button className="card-title" onClick={edit}>
          {entry.anime.title}
        </button>
        <p className="muted">
          Episode {entry.episodesWatched}{" "}
          <span>/ {entry.anime.episodes || "?"}</span>
        </p>
        <div className="progress-track">
          <span
            style={{
              width: `${entry.anime.episodes ? (entry.episodesWatched / entry.anime.episodes) * 100 : 0}%`,
            }}
          />
        </div>
      </div>
      <button
        className="add-button"
        disabled={
          increment.isPending ||
          (entry.anime.episodes > 0 &&
            entry.episodesWatched >= entry.anime.episodes)
        }
        onClick={() => increment.mutate()}
        aria-label={`Mark next episode of ${entry.anime.title} watched`}
      >
        {increment.isPending ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <Plus size={18} />
        )}
      </button>
    </article>
  );
}
