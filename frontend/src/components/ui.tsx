import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  LoaderCircle,
  Plus,
  Sparkles,
  Star,
} from "lucide-react";
import { api } from "../api";
import { entryInput, errorText, useApp, useRefreshLibrary } from "../context";
import type { Anime } from "../types";
import { statusLabels } from "../types";
import { releaseYear } from "../format";

export function PageHeading({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{text}</p>
      </div>
      {action}
    </div>
  );
}
export function SectionHeading({
  title,
  subtitle,
  link,
  to,
}: {
  title: string;
  subtitle?: string;
  link?: string;
  to?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {to && (
        <Link className="text-link" to={to}>
          {link}
          <ArrowUpRight size={17} />
        </Link>
      )}
    </div>
  );
}
export function ErrorPanel({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div role="alert" className="error-panel">
      <span>{errorText(error)}</span>
      <button className="text-link" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
  page = false,
}: {
  title: string;
  text: string;
  action?: ReactNode;
  page?: boolean;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <BookOpen size={28} />
      </span>
      {page ? <h1>{title}</h1> : <h2>{title}</h2>}
      <p>{text}</p>
      {action}
    </div>
  );
}
export function SignInPrompt({ title }: { title: string }) {
  const { openAuth } = useApp();
  return (
    <Empty
      page
      title={title}
      text="Sign in to save your progress, ratings, and notes across visits."
      action={
        <button className="button primary" onClick={openAuth}>
          Sign in
          <ArrowRight size={16} />
        </button>
      }
    />
  );
}
export function Skeletons({ count = 6 }: { count?: number }) {
  return (
    <div className="anime-grid" aria-label="Loading anime" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-card">
          <div />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
export function Poster({
  anime,
  className = "",
  eager = false,
  decorative = false,
}: {
  anime: Anime;
  className?: string;
  eager?: boolean;
  decorative?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = !anime.posterUrl || failedUrl === anime.posterUrl;
  return (
    <div
      className={`poster ${className} poster-${anime.id % 5}`}
      aria-hidden={decorative || undefined}
    >
      {!failed && (
        <img
          src={anime.posterUrl}
          alt={anime.title}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding="async"
          onError={() => setFailedUrl(anime.posterUrl)}
        />
      )}
      {failed && (
        <span className="poster-fallback">
          <Sparkles size={32} />
          <strong>{anime.title}</strong>
        </span>
      )}
    </div>
  );
}
export function AnimeCard({ anime }: { anime: Anime }) {
  const {
    entries,
    detail,
    edit,
    user,
    openAuth,
    notify,
    libraryPending,
    libraryError,
  } = useApp();
  const existing = entries.find((entry) => entry.animeId === anime.id);
  const refresh = useRefreshLibrary();
  const add = useMutation({
    mutationFn: () =>
      api(`/library/${anime.id}`, {
        method: "PUT",
        body: JSON.stringify(entryInput()),
      }),
    onSuccess: async () => {
      await refresh();
      notify(`Added ${anime.title} to your library.`);
    },
    onError: (error) => notify(errorText(error), "error"),
  });
  return (
    <article className="anime-card">
      <button
        className="poster-button"
        onClick={() => detail(anime)}
        aria-label={`View ${anime.title}`}
      >
        <Poster anime={anime} />
        {anime.communityScore > 0 && (
          <span
            className="rating"
            aria-label={`Aggregate rating ${anime.communityScore.toFixed(2)} out of 10`}
          >
            <Star size={12} fill="currentColor" />
            {anime.communityScore.toFixed(2)}
          </span>
        )}
        <span className="poster-view">
          View story
          <ArrowUpRight size={17} />
        </span>
      </button>
      <div className="card-body">
        <div className="card-meta">
          {anime.format}
          <span>·</span>
          {releaseYear(anime.year)}
        </div>
        <button
          className="card-title"
          title={anime.title}
          onClick={() => detail(anime)}
        >
          {anime.title}
        </button>
        <div className="card-bottom">
          <span>
            {existing
              ? statusLabels[existing.status]
              : anime.genres.slice(0, 2).join(" · ")}
          </span>
          <button
            className={`add-button ${existing ? "added" : ""}`}
            aria-label={
              existing ? `Edit ${anime.title}` : `Add ${anime.title} to library`
            }
            disabled={add.isPending || libraryPending || !!libraryError}
            onClick={() =>
              existing ? edit(anime) : user ? add.mutate() : openAuth()
            }
          >
            {add.isPending ? (
              <LoaderCircle size={16} className="spin" />
            ) : existing ? (
              <Check size={17} />
            ) : (
              <Plus size={17} />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
export function Stat({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
}) {
  return (
    <div className="stat">
      <span className="stat-icon">{icon}</span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
