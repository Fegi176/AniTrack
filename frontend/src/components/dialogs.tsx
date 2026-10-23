import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Plus,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { api, ApiError, announceSessionChange, resetCsrf } from "../api";
import { entryInput, errorText, useApp, useRefreshLibrary } from "../context";
import { statuses, statusLabels } from "../types";
import type { Anime, EntryInput, Status, User } from "../types";
import { Poster } from "./ui";
import { episodeCount, releaseYear } from "../format";

function Modal({
  title,
  close,
  children,
  className = "",
  busy = false,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  className?: string;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current!;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el.showModal();
    el.querySelector<HTMLInputElement>("input:not([disabled])")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (el.open) el.close();
      if (opener?.isConnected && !opener.closest("[inert]"))
        opener.focus({ preventScroll: true });
      else document.getElementById("main")?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${className}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            !busy &&
            (event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom)
          )
            close();
        }
      }}
    >
      <button
        className="modal-close icon-button"
        aria-label="Close dialog"
        disabled={busy}
        onClick={close}
      >
        <X size={20} />
      </button>
      {children}
    </dialog>
  );
}
export function AuthDialog({ close }: { close: () => void }) {
  return <AuthPanel close={close} />;
}
export function AuthPanel({
  close,
  standalone = false,
}: {
  close: () => void;
  standalone?: boolean;
}) {
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const client = useQueryClient();
  const config = useQuery({
    queryKey: ["config"],
    queryFn: () => api<{ demoEnabled: boolean }>("/config"),
  });
  const auth = useMutation({
    mutationFn: (demo: boolean) =>
      api<User>(`/auth/${demo ? "demo" : register ? "register" : "login"}`, {
        method: "POST",
        body: demo
          ? undefined
          : JSON.stringify({ username, password, displayName }),
      }),
    onSuccess: (user) => {
      resetCsrf();
      for (const key of ["library", "insights", "history", "achievements"])
        client.removeQueries({ queryKey: [key] });
      client.setQueryData(["me"], user);
      announceSessionChange();
      close();
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    auth.mutate(false);
  }
  const content = (
    <>
      <span className="brand-mark">
        <BookOpen size={24} />
      </span>
      <p className="eyebrow">YOUR NEXT CHAPTER</p>
      <h2>{register ? "Create your account." : "Welcome back."}</h2>
      <p className="muted">Your watchlist, wherever you left it.</p>
      <form className="form" onSubmit={submit}>
        {register && (
          <label>
            Display name
            <input
              autoComplete="nickname"
              autoFocus
              disabled={auth.isPending}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={50}
            />
          </label>
        )}
        <label>
          Username
          <input
            autoComplete="username"
            disabled={auth.isPending}
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={register ? 3 : 1}
            maxLength={30}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            disabled={auth.isPending}
            autoComplete={register ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={register ? 8 : 1}
            maxLength={128}
          />
        </label>
        {register && (
          <span className="fine-print">
            At least 8 characters, including a lowercase letter and a number.
          </span>
        )}
        {auth.isError && (
          <p className="form-error" role="alert">
            {errorText(auth.error)}
          </p>
        )}
        <button className="button primary full" disabled={auth.isPending}>
          {auth.isPending
            ? "One moment…"
            : register
              ? "Create account"
              : "Sign in"}
          <ArrowRight size={17} />
        </button>
      </form>
      <p className="auth-toggle">
        {register ? "Already have a space?" : "New around here?"}{" "}
        <button
          disabled={auth.isPending}
          onClick={() => {
            setRegister(!register);
            auth.reset();
          }}
        >
          {register ? "Sign in" : "Create an account"}
        </button>
      </p>
      {config.data?.demoEnabled && (
        <>
          <div className="divider">
            <span>OR TAKE A LOOK AROUND</span>
          </div>
          <button
            className="button secondary full"
            disabled={auth.isPending}
            onClick={() => auth.mutate(true)}
          >
            <Sparkles size={16} />
            Try the demo
          </button>
          <p className="fine-print centered">
            Explore with a separate demo library. No sign-up needed.
          </p>
        </>
      )}
    </>
  );
  return standalone ? (
    <section
      className="auth-modal login-form-panel"
      aria-label={register ? "Create your account" : "Sign in"}
    >
      {content}
    </section>
  ) : (
    <Modal
      title={register ? "Create your account" : "Sign in"}
      close={close}
      className="auth-modal"
      busy={auth.isPending}
    >
      {content}
    </Modal>
  );
}
export function DetailDialog({
  anime,
  close,
}: {
  anime: Anime;
  close: () => void;
}) {
  const { entries, edit, libraryPending, libraryError } = useApp();
  const entry = entries.find((e) => e.animeId === anime.id);
  return (
    <Modal title={anime.title} close={close} className="detail-modal">
      <div className="detail-top">
        <Poster anime={anime} eager />
        <div>
          <p className="eyebrow">
            {anime.format} · {releaseYear(anime.year)}
          </p>
          <h2>{anime.title}</h2>
          <p className="muted original-title">{anime.originalTitle}</p>
          {anime.communityScore > 0 ? (
            <span className="detail-rating">
              <Star size={17} fill="currentColor" />
              {anime.communityScore.toFixed(2)}
              <span>Aggregate rating / 10</span>
            </span>
          ) : (
            <p className="muted unrated">Not rated yet</p>
          )}
          <div className="detail-tags">
            {anime.genres.map((g) => (
              <span key={g}>{g}</span>
            ))}
          </div>
        </div>
      </div>
      <p className="synopsis">
        {anime.synopsis ||
          "A synopsis is not available in this catalog. Visit the source entry for more about this title."}
      </p>
      <div className="detail-facts">
        <div>
          <span>STUDIO</span>
          <strong>{anime.studio || "Not listed"}</strong>
        </div>
        <div>
          <span>EPISODES</span>
          <strong>{anime.episodes || "Not announced"}</strong>
        </div>
        <div>
          <span>RUNTIME</span>
          <strong>
            {anime.episodeMinutes
              ? `${anime.episodeMinutes} min / ep`
              : "Not listed"}
          </strong>
        </div>
      </div>
      <button
        className="button primary full"
        disabled={libraryPending || !!libraryError}
        onClick={() => edit(anime)}
      >
        {entry ? <Settings2 size={17} /> : <Plus size={17} />}
        {libraryPending
          ? "Loading your library…"
          : entry
            ? "Update your progress"
            : "Add to my library"}
      </button>
      {anime.sourceUrl && (
        <a
          className="detail-source text-link"
          href={anime.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          View on MyAnimeList
          <ArrowUpRight size={15} />
        </a>
      )}
    </Modal>
  );
}
export function EditorDialog({
  anime,
  close,
}: {
  anime: Anime;
  close: () => void;
}) {
  const { entries, notify } = useApp();
  const existing = entries.find((e) => e.animeId === anime.id);
  const [input, setInput] = useState<EntryInput>(() => entryInput(existing));
  const refresh = useRefreshLibrary();
  const save = useMutation({
    mutationFn: () =>
      api(`/library/${anime.id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await refresh();
      notify(
        existing ? "Your progress has been saved." : "Added to your library.",
      );
      close();
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409) await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () =>
      api(`/library/${anime.id}?revision=${input.revision}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await refresh();
      notify("Removed from your library.");
      close();
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409) await refresh();
    },
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = save.isPending || remove.isPending;
  return (
    <Modal
      title={`Track ${anime.title}`}
      close={close}
      className="editor-modal"
      busy={busy}
    >
      <div className="editor-heading">
        <Poster anime={anime} />
        <div>
          <p className="eyebrow">YOUR STORY SO FAR</p>
          <h2>{anime.title}</h2>
          <p className="muted">
            {episodeCount(anime.episodes)} · {releaseYear(anime.year)}
          </p>
        </div>
      </div>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label>
          Status
          <select
            disabled={busy}
            value={input.status}
            onChange={(e) =>
              setInput({
                ...input,
                status: e.target.value as Status,
                episodesWatched:
                  e.target.value === "PlanToWatch"
                    ? 0
                    : e.target.value === "Completed" && anime.episodes > 0
                      ? anime.episodes
                      : input.episodesWatched,
              })
            }
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <div className="form-columns">
          <label>
            Episodes watched
            <input
              type="number"
              value={
                input.status === "Completed" && anime.episodes
                  ? anime.episodes
                  : input.status === "PlanToWatch"
                    ? 0
                    : input.episodesWatched
              }
              min={0}
              max={anime.episodes || 100000}
              required
              disabled={
                busy ||
                input.status === "PlanToWatch" ||
                (input.status === "Completed" && anime.episodes > 0)
              }
              onChange={(e) =>
                setInput({ ...input, episodesWatched: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Your rating
            <select
              disabled={busy}
              value={input.score ?? ""}
              onChange={(e) =>
                setInput({
                  ...input,
                  score: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">Not rated yet</option>
              {Array.from({ length: 10 }, (_, i) => 10 - i).map((score) => (
                <option key={score} value={score}>
                  {score} / 10
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="fine-print">
          {input.status === "PlanToWatch"
            ? "Plan to watch keeps your progress at zero."
            : input.status === "Completed" && anime.episodes > 0
              ? `Completing this title marks all ${episodeCount(anime.episodes)} as watched.`
              : "Reaching the final episode automatically marks a title complete."}
        </p>
        <label>
          Private notes
          <textarea
            disabled={busy}
            rows={3}
            maxLength={2000}
            placeholder="A favorite moment, a thought for later…"
            value={input.notes}
            onChange={(e) => setInput({ ...input, notes: e.target.value })}
          />
        </label>
        {(save.isError || remove.isError) && (
          <div className="form-error" role="alert">
            <p>{errorText(save.error ?? remove.error)}</p>
            {((save.error instanceof ApiError && save.error.status === 409) ||
              (remove.error instanceof ApiError &&
                remove.error.status === 409)) && (
              <button
                type="button"
                className="button secondary conflict-reload"
                onClick={() => {
                  setInput(entryInput(existing));
                  setConfirmDelete(false);
                  save.reset();
                  remove.reset();
                }}
              >
                Reload latest version
              </button>
            )}
          </div>
        )}
        <button className="button primary full" disabled={busy}>
          {save.isPending ? "Saving…" : "Save to my library"}
          <Check size={17} />
        </button>
      </form>
      {existing && (
        <div className="remove-row">
          {confirmDelete ? (
            <>
              <span>Remove this title and its progress?</span>
              <button
                className="danger-link"
                disabled={busy}
                onClick={() => remove.mutate()}
              >
                Yes, remove
              </button>
              <button disabled={busy} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              className="danger-link"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} />
              Remove from library
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
