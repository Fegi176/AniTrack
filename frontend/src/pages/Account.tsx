import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Clock3,
  Film,
  Star,
  Upload,
} from "lucide-react";
import { api } from "../api";
import { errorText, useApp, useRefreshLibrary } from "../context";
import { statusLabels } from "../types";
import type { Insights, User } from "../types";
import { counted, number } from "../format";
import { Avatar } from "../components/Avatar";
import { InsightsNav } from "../components/InsightsNav";
import {
  Empty,
  ErrorPanel,
  PageHeading,
  SignInPrompt,
  Stat,
} from "../components/ui";

export function InsightsPage() {
  const { user } = useApp();
  const insights = useQuery({
    queryKey: ["insights", user?.id],
    queryFn: () => api<Insights>("/insights"),
    enabled: !!user,
  });
  if (!user) return <SignInPrompt title="Your journey, by the numbers." />;
  const data = insights.data;
  return (
    <>
      <PageHeading
        eyebrow="A LOOK AT YOUR JOURNEY"
        title="Your viewing, in perspective."
        text="See your progress, favorite genres, and the time spent with your stories."
      />
      <InsightsNav />
      {insights.isPending ? (
        <p className="muted">Gathering your insights…</p>
      ) : insights.isError ? (
        <ErrorPanel
          error={insights.error}
          retry={() => void insights.refetch()}
        />
      ) : (
        data && (
          <>
            <div className="stat-strip insight-stats">
              <Stat
                icon={<Film size={18} />}
                value={number(data.totalTitles)}
                label="Titles in your library"
              />
              <Stat
                icon={<Check size={18} />}
                value={number(data.episodesWatched)}
                label="Episodes watched"
              />
              <Stat
                icon={<Clock3 size={18} />}
                value={`${number(data.hoursWatched)}h`}
                label="Estimated watch time"
              />
              <Stat
                icon={<Star size={18} />}
                value={data.meanScore ?? "—"}
                label="Your average rating"
              />
            </div>
            {!data.totalTitles ? (
              <Empty
                title="A fresh page."
                text="Add your first anime and your viewing insights will appear here."
                action={
                  <Link to="/discover" className="button primary">
                    Discover anime
                    <ArrowRight size={16} />
                  </Link>
                }
              />
            ) : (
              <>
                <div className="insights-grid">
                  <section className="panel">
                    <h2>Where your stories stand</h2>
                    <p className="muted">A little progress adds up.</p>
                    <div className="status-chart">
                      {data.statuses.map((item) => (
                        <div key={item.status}>
                          <span className={`chart-dot status-${item.status}`} />
                          <span>{statusLabels[item.status]}</span>
                          <div className="bar-track">
                            <span
                              style={{
                                width: `${(item.count / Math.max(1, data.totalTitles)) * 100}%`,
                              }}
                            />
                          </div>
                          <strong>{item.count}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="panel">
                    <h2>Your favorite worlds</h2>
                    <p className="muted">Genres across your saved titles.</p>
                    <div className="genre-chart">
                      {data.genres.map((genre, i) => (
                        <div key={genre.name}>
                          <span>0{i + 1}</span>
                          <strong>{genre.name}</strong>
                          <span>{counted(genre.count, "title")}</span>
                          <div className="bar-track">
                            <span
                              style={{
                                width: `${(genre.count / Math.max(1, data.genres[0]?.count ?? 1)) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
                <section className="panel ratings-panel">
                  <h2>How you rate your stories</h2>
                  <p className="muted">Your ratings, from 1 to 10.</p>
                  <div
                    className="rating-chart"
                    role="img"
                    aria-label={data.ratings
                      .map(
                        (r) =>
                          `Rating ${r.score}: ${counted(r.count, "title")}`,
                      )
                      .join(", ")}
                  >
                    {data.ratings.map((r) => (
                      <div key={r.score}>
                        <span>{r.count || ""}</span>
                        <div
                          style={{
                            height: `${(r.count / Math.max(1, ...data.ratings.map((x) => x.count))) * 130}px`,
                          }}
                        />
                        <strong>{r.score}</strong>
                      </div>
                    ))}
                  </div>
                </section>
                <p className="fine-print">
                  Watch time is estimated from logged episodes and catalog
                  runtimes. Genre counts include each genre attached to a title.
                  {data.unknownRuntimeTitles > 0 &&
                    ` ${counted(data.unknownRuntimeTitles, "title")} with an unknown runtime ${data.unknownRuntimeTitles === 1 ? "is" : "are"} excluded from the watch-time estimate.`}
                </p>
              </>
            )}
          </>
        )
      )}
    </>
  );
}
export function SettingsPage() {
  const { user } = useApp();
  return user ? (
    <ProfileSettings key={user.id} user={user} />
  ) : (
    <SignInPrompt title="A space that feels like you." />
  );
}
function ProfileSettings({ user }: { user: User }) {
  const { notify } = useApp();
  const client = useQueryClient();
  const refresh = useRefreshLibrary();
  const [name, setName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [importResult, setImportResult] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const pictureFile = useRef<HTMLInputElement>(null);
  const picture = useMutation({
    mutationFn: async (source: File | null) => {
      if (!source) return api<User>("/profile/avatar", { method: "DELETE" });
      if (source.size > 2 * 1024 * 1024)
        throw new Error("Choose a picture smaller than 2 MB.");
      if (!["image/jpeg", "image/png", "image/webp"].includes(source.type))
        throw new Error("Choose a JPG, PNG, or WebP picture.");
      return api<User>("/profile/avatar", {
        method: "PUT",
        headers: { "Content-Type": source.type },
        body: source,
      });
    },
    onSuccess: (data, source) => {
      client.setQueryData(["me"], data);
      notify(
        source
          ? "Your profile picture has been updated."
          : "Your profile picture has been removed.",
      );
    },
  });
  const save = useMutation({
    mutationFn: () =>
      api<User>("/profile", {
        method: "PUT",
        body: JSON.stringify({ displayName: name, bio }),
      }),
    onSuccess: (data) => {
      client.setQueryData(["me"], data);
      notify("Your profile has been updated.");
    },
  });
  const importList = useMutation({
    mutationFn: async (source: File) => {
      if (source.size > 2 * 1024 * 1024)
        throw new Error("Choose an XML file smaller than 2 MB.");
      return api<{ message: string }>("/library/import", {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: await source.text(),
      });
    },
    onSuccess: async (result) => {
      await refresh();
      setImportResult(result.message);
      notify("Your library import is complete.");
    },
  });
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="Profile & data."
        text="Make this space yours and keep a copy of your watchlist."
      />
      <div className="settings-grid">
        <section className="panel">
          <h2>Your profile</h2>
          <p className="muted">A name and a few words about you.</p>
          <div className="picture-control">
            <Avatar user={user} />
            <div>
              <h3>Profile picture</h3>
              <p className="muted">
                JPG, PNG or WebP, up to 2 MB. Cropped to a square.
              </p>
              <input
                ref={pictureFile}
                type="file"
                className="sr-only"
                tabIndex={-1}
                aria-label="Choose profile picture"
                accept="image/jpeg,image/png,image/webp"
                disabled={picture.isPending || save.isPending}
                onChange={(event) => {
                  const source = event.target.files?.[0];
                  if (source) picture.mutate(source);
                  event.target.value = "";
                }}
              />
              <div className="picture-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={picture.isPending || save.isPending}
                  onClick={() => pictureFile.current?.click()}
                >
                  <Upload size={15} />
                  {picture.isPending
                    ? "Saving…"
                    : user.avatarUrl
                      ? "Change picture"
                      : "Upload picture"}
                </button>
                {user.avatarUrl && (
                  <button
                    type="button"
                    className="picture-remove"
                    disabled={picture.isPending || save.isPending}
                    onClick={() => picture.mutate(null)}
                  >
                    Remove picture
                  </button>
                )}
              </div>
            </div>
          </div>
          {picture.isError && (
            <p className="form-error" role="alert">
              {errorText(picture.error)}
            </p>
          )}
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <label>
              Username
              <input
                value={user.isDemo ? "Demo explorer" : user.username}
                disabled
              />
            </label>
            <label>
              Display name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={50}
                autoComplete="nickname"
                disabled={save.isPending}
                required
              />
            </label>
            <label>
              Bio
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={300}
                disabled={save.isPending}
                rows={4}
                placeholder="A favorite genre, a comfort show, a little about you…"
              />
            </label>
            {save.isError && (
              <p className="form-error" role="alert">
                {errorText(save.error)}
              </p>
            )}
            <button
              className="button primary"
              disabled={save.isPending || picture.isPending}
            >
              {save.isPending ? "Saving…" : "Save profile"}
              <Check size={16} />
            </button>
          </form>
          {user.isDemo && (
            <p className="fine-print demo-note">
              You're using a demo account. After signing out, create a regular
              account to keep access to your own watchlist.
            </p>
          )}
        </section>
        <section className="panel data-panel">
          <h2>Your list goes with you</h2>
          <p className="muted">
            Import an existing MyAnimeList XML export, or take your AniTrack
            library with you.
          </p>
          <div className="data-action">
            <span className="stat-icon">
              <Upload size={20} />
            </span>
            <div>
              <h3>Bring your list over</h3>
              <p>
                Updates matching titles. Titles outside this catalog are
                reported as skipped. Maximum 2 MB.
              </p>
            </div>
            <input
              ref={file}
              type="file"
              tabIndex={-1}
              accept=".xml,application/xml,text/xml"
              className="sr-only"
              aria-label="Import MyAnimeList XML"
              onChange={(event) => {
                const source = event.target.files?.[0];
                setImportResult("");
                if (source) importList.mutate(source);
                event.target.value = "";
              }}
            />
            <button
              className="button secondary"
              disabled={importList.isPending}
              onClick={() => file.current?.click()}
            >
              {importList.isPending ? "Importing…" : "Import XML"}
            </button>
          </div>
          {importList.isError && (
            <p className="form-error" role="alert">
              {errorText(importList.error)}
            </p>
          )}
          {importResult && (
            <p className="success-message" role="status">
              {importResult}
            </p>
          )}
          <div className="data-action">
            <span className="stat-icon">
              <ArrowDownToLine size={20} />
            </span>
            <div>
              <h3>Keep a copy</h3>
              <p>
                Export your statuses, ratings, notes, and progress as
                MyAnimeList compatible XML.
              </p>
            </div>
            <a className="button secondary" href="/api/library/export" download>
              Export XML
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
