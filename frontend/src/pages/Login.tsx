import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AuthPanel } from "../components/dialogs";
import { ErrorPanel } from "../components/ui";
import { api } from "../api";
import type { Catalog } from "../types";

export function LoginPage({
  error,
  retry,
}: {
  error: Error | null;
  retry: () => void;
}) {
  const navigate = useNavigate();
  const picks = useQuery({
    queryKey: ["login-picks"],
    queryFn: () => api<Catalog>("/catalog?pageSize=3"),
  });
  return (
    <div className="login-page">
      <a className="skip-link" href="#main">
        Skip to sign in
      </a>
      <header className="login-header">
        <Link className="brand" to="/login" aria-label="AniTrack home">
          <span className="brand-mark">
            <BookOpen size={22} />
          </span>
          AniTrack<span className="brand-dot">.</span>
        </Link>
        <Link className="login-browse" to="/discover">
          Browse anime <ArrowUpRight size={16} />
        </Link>
      </header>
      <main id="main" className="login-layout" tabIndex={-1}>
        <section className="login-story">
          <p className="eyebrow">A HOME FOR YOUR ANIME JOURNEY</p>
          <h1>
            Good stories deserve
            <br />
            <em>a place to stay.</em>
          </h1>
          <p>
            Keep your favorites close, track every episode, and find your next
            great story.
          </p>
          <div className="login-covers" aria-hidden="true">
            {picks.data?.items.map((anime) => (
              <div key={anime.id}>
                <img
                  src={anime.posterUrl}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                />
              </div>
            ))}
          </div>
          <span className="login-story-note">
            <BookOpen size={18} /> One episode at a time.
          </span>
        </section>
        <div className="login-form-wrap">
          {error && <ErrorPanel error={error} retry={retry} />}
          <AuthPanel
            standalone
            close={() => navigate("/", { replace: true })}
          />
          <p className="login-caption">Your stories. Your pace. Your space.</p>
        </div>
      </main>
    </div>
  );
}
