import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  BookOpen,
  Check,
  CircleCheck,
  Clapperboard,
  Compass,
  Flag,
  History,
  LockKeyhole,
  MessageSquare,
  Plus,
  Star,
  Trash2,
  Trophy,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "../api";
import { useApp } from "../context";
import { counted, number, positiveInteger } from "../format";
import { statusLabels } from "../types";
import type { Activity, ActivityPage, Achievements } from "../types";
import { Empty, ErrorPanel, PageHeading, SignInPrompt } from "../components/ui";
import { InsightsNav } from "../components/InsightsNav";
import { Pagination } from "../components/Pagination";

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
const timeLabel = (value: string) =>
  new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(
    new Date(value),
  );

function describe(item: Activity) {
  if (item.kind === "Imported")
    return {
      Icon: Upload,
      heading: "Imported your anime list",
      details: `${counted(item.importedAdded + item.importedUpdated, "title")} imported · ${item.importedAdded} new · ${item.importedUpdated} updated${item.importedSkipped ? ` · ${item.importedSkipped} skipped` : ""}`,
    };
  if (item.kind === "Removed")
    return {
      Icon: Trash2,
      heading: "Removed from your library",
      details: "Your activity and earned achievements are kept.",
    };
  if (item.kind === "Added")
    return {
      Icon: Plus,
      heading: "Added to your library",
      details: [
        item.toStatus && statusLabels[item.toStatus],
        `${counted(item.toEpisodes ?? 0, "episode")} logged`,
        item.toScore !== null && `Rated ${item.toScore}/10`,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  const episodesChanged = item.fromEpisodes !== item.toEpisodes;
  const statusChanged = item.fromStatus !== item.toStatus;
  const scoreChanged = item.fromScore !== item.toScore;
  const completed = statusChanged && item.toStatus === "Completed";
  const heading = completed
    ? "Completed an anime"
    : episodesChanged
      ? "Updated episode progress"
      : statusChanged
        ? "Changed watch status"
        : scoreChanged
          ? "Updated your rating"
          : "Updated private notes";
  const details = [
    episodesChanged &&
      `Episodes: ${number(item.fromEpisodes ?? 0)} → ${number(item.toEpisodes ?? 0)}`,
    statusChanged &&
      item.fromStatus &&
      item.toStatus &&
      `${statusLabels[item.fromStatus]} → ${statusLabels[item.toStatus]}`,
    scoreChanged &&
      (item.toScore === null
        ? "Rating removed"
        : `Rating: ${item.fromScore ?? "unrated"} → ${item.toScore}/10`),
    item.notesChanged && "Private notes updated",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    Icon: completed
      ? CircleCheck
      : scoreChanged
        ? Star
        : episodesChanged
          ? History
          : MessageSquare,
    heading,
    details,
  };
}

export function HistoryPage() {
  const { user } = useApp();
  const [params, setParams] = useSearchParams();
  const page = positiveInteger(params.get("page"));
  const history = useQuery({
    queryKey: ["history", user?.id, page],
    queryFn: () => api<ActivityPage>(`/history?page=${page}`),
    enabled: !!user,
  });
  if (!user) return <SignInPrompt title="Keep your story going." />;
  const data = history.data;
  return (
    <>
      <PageHeading
        eyebrow="ONE CHAPTER AT A TIME"
        title="Your viewing history."
        text="A record of your library, progress, and the stories you finish."
      />
      <InsightsNav />
      {history.isPending ? (
        <p className="muted" role="status">
          Loading your history…
        </p>
      ) : history.isError ? (
        <ErrorPanel
          error={history.error}
          retry={() => void history.refetch()}
        />
      ) : (
        data && (
          <>
            <div className="progress-section-heading">
              <h2>Your recent activity</h2>
              <span className="muted">{counted(data.total, "change")}</span>
            </div>
            {!data.items.length ? (
              <Empty
                title="A story waiting to be written."
                text="Your next library change will appear here. Existing progress already counts toward achievements."
                action={
                  <Link className="button primary" to="/discover">
                    Discover anime <Compass size={16} />
                  </Link>
                }
              />
            ) : (
              <ol className="activity-list">
                {data.items.map((item) => {
                  const { Icon, heading, details } = describe(item);
                  return (
                    <li
                      key={item.id}
                      className={`activity-row activity-${item.kind.toLowerCase()}`}
                    >
                      <span className="activity-icon" aria-hidden="true">
                        <Icon size={19} />
                      </span>
                      <div className="activity-content">
                        <h3>{heading}</h3>
                        {item.animeId && (
                          <Link
                            className="activity-title"
                            to={`/discover?q=${encodeURIComponent(item.title)}`}
                          >
                            {item.title}
                          </Link>
                        )}
                        <p>{details}</p>
                      </div>
                      <time dateTime={item.occurredAt}>
                        <span>{dateLabel(item.occurredAt)}</span>
                        <span>{timeLabel(item.occurredAt)}</span>
                      </time>
                    </li>
                  );
                })}
              </ol>
            )}
            {data.totalPages > 1 && (
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                label="History pages"
                changePage={(next) => {
                  setParams({ page: String(next) });
                  window.scrollTo(0, 0);
                }}
              />
            )}
            <p className="fine-print progress-footnote">
              History records changes made in AniTrack. Imports are dated when
              imported, rather than when the episodes were watched. Earlier
              activity is not reconstructed.
            </p>
          </>
        )
      )}
    </>
  );
}

const icons: Record<string, LucideIcon> = {
  "first-title": BookOpen,
  "shelf-builder": Plus,
  "first-finish": Flag,
  "ten-finishes": Trophy,
  "hundred-episodes": History,
  "thousand-episodes": Award,
  "five-ratings": Star,
  "genre-explorer": Compass,
  "movie-night": Clapperboard,
};

export function AchievementsPage() {
  const { user } = useApp();
  const achievements = useQuery({
    queryKey: ["achievements", user?.id],
    queryFn: () => api<Achievements>("/achievements"),
    enabled: !!user,
  });
  if (!user) return <SignInPrompt title="Your next milestone starts here." />;
  const data = achievements.data;
  return (
    <>
      <PageHeading
        eyebrow="LITTLE MOMENTS, REAL PROGRESS"
        title="Your achievements."
        text="Milestones earned from the anime you save, watch, finish, and rate."
      />
      <InsightsNav />
      {achievements.isPending ? (
        <p className="muted" role="status">
          Finding your milestones…
        </p>
      ) : achievements.isError ? (
        <ErrorPanel
          error={achievements.error}
          retry={() => void achievements.refetch()}
        />
      ) : (
        data && (
          <>
            <div className="achievement-summary">
              <span className="achievement-summary-icon" aria-hidden="true">
                <Trophy size={28} />
              </span>
              <div>
                <h2>
                  {data.unlocked} of {data.total} unlocked
                </h2>
                <p>Every story takes you a little further.</p>
              </div>
              <Link className="text-link" to="/library">
                Keep watching <BookOpen size={16} />
              </Link>
            </div>
            <div className="achievement-grid">
              {[...data.items]
                .sort((a, b) => Number(!!b.unlockedAt) - Number(!!a.unlockedAt))
                .map((item) => {
                  const Icon = icons[item.code] ?? Award;
                  return (
                    <article
                      className={`achievement-card ${item.unlockedAt ? "is-unlocked" : "is-locked"}`}
                      key={item.code}
                    >
                      <div className="achievement-card-top">
                        <span className="achievement-icon" aria-hidden="true">
                          <Icon size={24} />
                        </span>
                        <span className="achievement-state">
                          {item.unlockedAt ? (
                            <>
                              <Check size={13} /> Unlocked
                            </>
                          ) : (
                            <>
                              <LockKeyhole size={12} /> In progress
                            </>
                          )}
                        </span>
                      </div>
                      <h2>{item.title}</h2>
                      <p>{item.description}</p>
                      <div
                        className="achievement-progress"
                        role="progressbar"
                        aria-label={`${item.title} progress`}
                        aria-valuemin={0}
                        aria-valuemax={item.target}
                        aria-valuenow={item.progress}
                      >
                        <span
                          style={{
                            width: `${(item.progress / item.target) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="achievement-caption">
                        {item.unlockedAt
                          ? `Unlocked ${dateLabel(item.unlockedAt)}`
                          : `${number(item.progress)} / ${number(item.target)}`}
                      </span>
                    </article>
                  );
                })}
            </div>
            <p className="fine-print progress-footnote">
              Existing and imported progress counts. Earned achievements stay
              unlocked when you edit or remove titles. Unlock dates show when
              AniTrack recognized a milestone.
            </p>
          </>
        )
      )}
    </>
  );
}
