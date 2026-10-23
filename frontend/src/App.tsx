import { useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CircleAlert,
  ChevronRight,
  Compass,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Search,
  Settings2,
  X,
} from "lucide-react";
import {
  api,
  ApiError,
  announceSessionChange,
  resetCsrf,
  SESSION_CHANGED,
  SESSION_EXPIRED,
} from "./api";
import { AppContext, errorText } from "./context";
import type { AppState } from "./context";
import type { Anime, Entry, User } from "./types";
import { Empty, ErrorPanel } from "./components/ui";
import { AuthDialog, DetailDialog, EditorDialog } from "./components/dialogs";
import { Overview } from "./pages/Overview";
import { Discover } from "./pages/Discover";
import { Library } from "./pages/Library";
import { InsightsPage, SettingsPage } from "./pages/Account";
import { LoginPage } from "./pages/Login";
import { Avatar } from "./components/Avatar";
import "./App.css";
import { useMobileNavigation } from "./hooks/useMobileNavigation";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});
function Shell() {
  const client = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [selected, setSelected] = useState<Anime | null>(null);
  const [editing, setEditing] = useState<Anime | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    kind: "success" | "error";
  } | null>(null);
  const [search, setSearch] = useState("");
  const sidebar = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);
  const mobile = useMobileNavigation(mobileOpen, setMobileOpen, sidebar);
  const notify = (message: string, kind: "success" | "error" = "success") =>
    setToast({ message, kind });
  const session = useQuery({
    queryKey: ["me"],
    queryFn: () => api<User | null>("/auth/me"),
  });
  const user = session.data ?? null;
  const library = useQuery({
    queryKey: ["library", user?.id],
    queryFn: () => api<Entry[]>("/library"),
    enabled: !!user,
  });
  useEffect(() => {
    window.scrollTo(0, 0);
    if (previousPath.current !== location.pathname)
      document.getElementById("main")?.focus({ preventScroll: true });
    previousPath.current = location.pathname;
  }, [location.pathname]);
  useEffect(() => {
    const clearPrivateState = () => {
      resetCsrf();
      setEditing(null);
      setSelected(null);
      setAuthOpen(false);
      setMobileOpen(false);
      client.setQueryData(["me"], null);
      void client.cancelQueries({ queryKey: ["library"] });
      void client.cancelQueries({ queryKey: ["insights"] });
      client.removeQueries({ queryKey: ["library"] });
      client.removeQueries({ queryKey: ["insights"] });
    };
    const refreshSession = () => {
      clearPrivateState();
      void client.invalidateQueries({ queryKey: ["me"] });
    };
    const expireSession = () => {
      clearPrivateState();
      setToast({
        message: "Your session has expired. Sign in again to continue.",
        kind: "error",
      });
    };
    window.addEventListener(SESSION_CHANGED, refreshSession);
    window.addEventListener(SESSION_EXPIRED, expireSession);
    return () => {
      window.removeEventListener(SESSION_CHANGED, refreshSession);
      window.removeEventListener(SESSION_EXPIRED, expireSession);
    };
  }, [client]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => setToast(null),
      toast.kind === "error" ? 8000 : 5000,
    );
    return () => clearTimeout(timer);
  }, [toast]);
  const logout = useMutation({
    mutationFn: async () => {
      try {
        await api("/auth/logout", { method: "POST" });
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) throw error;
      }
    },
    onSuccess: () => {
      resetCsrf();
      setMobileOpen(false);
      client.clear();
      client.setQueryData(["me"], null);
      announceSessionChange();
      navigate("/login");
      notify("You have signed out.");
    },
    onError: (error) => notify(errorText(error), "error"),
  });
  const title =
    location.pathname === "/discover"
      ? "Discover"
      : location.pathname === "/library"
        ? "My library"
        : location.pathname === "/insights"
          ? "Your insights"
          : location.pathname === "/settings"
            ? "Settings"
            : location.pathname === "/login"
              ? "Sign in"
              : "Overview";
  useEffect(() => {
    document.title = `${title} · AniTrack`;
  }, [title]);
  const context: AppState = {
    user,
    entries: user ? (library.data ?? []) : [],
    libraryPending: !!user && library.isPending,
    libraryError: library.error,
    sessionPending: session.isPending,
    openAuth: () => {
      setSelected(null);
      setMobileOpen(false);
      setAuthOpen(true);
    },
    detail: setSelected,
    edit: (anime) => {
      setSelected(null);
      if (!user) setAuthOpen(true);
      else setEditing(anime);
    },
    notify,
  };
  if (location.pathname === "/login") {
    if (session.isPending)
      return (
        <div className="route-loading" role="status">
          Loading your space…
        </div>
      );
    if (user) return <Navigate to="/" replace />;
    return (
      <LoginPage error={session.error} retry={() => void session.refetch()} />
    );
  }
  return (
    <AppContext.Provider value={context}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {mobileOpen && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          tabIndex={-1}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        ref={sidebar}
        id="main-sidebar"
        role={mobile && mobileOpen ? "dialog" : undefined}
        aria-modal={mobile && mobileOpen ? true : undefined}
        aria-label={mobile && mobileOpen ? "Navigation" : undefined}
        inert={mobile && !mobileOpen}
        aria-hidden={mobile && !mobileOpen ? true : undefined}
        className={`sidebar ${user ? "has-profile" : ""} ${mobileOpen ? "is-open" : ""}`}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setMobileOpen(false);
        }}
      >
        <button
          className="icon-button nav-close"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        >
          <X size={21} />
        </button>
        <Link className="brand" to="/">
          <span className="brand-mark">
            <BookOpen size={22} />
          </span>
          AniTrack<span className="brand-dot">.</span>
        </Link>
        {user && (
          <Link
            className="user-card"
            to="/settings"
            aria-label="View your profile"
          >
            <Avatar user={user} />
            <strong title={user.displayName}>{user.displayName}</strong>
            <span className="profile-username">
              @{user.isDemo ? "demo explorer" : user.username}
            </span>
            <span className="profile-link-label">
              Your profile <ChevronRight size={13} />
            </span>
          </Link>
        )}
        <span className="nav-label">YOUR SPACE</span>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>
            <LayoutDashboard size={19} />
            Overview
          </NavLink>
          <NavLink to="/discover">
            <Compass size={19} />
            Discover<span className="nav-new">EXPLORE</span>
          </NavLink>
          <NavLink to="/library">
            <BookOpen size={19} />
            My library
            {user && (
              <span className="nav-count">{context.entries.length}</span>
            )}
          </NavLink>
          <NavLink to="/insights">
            <BarChart3 size={19} />
            Insights
          </NavLink>
        </nav>
        {!user && (
          <div className="sidebar-note">
            <span className="tiny-orbit">✳</span>
            <p>
              Good stories deserve
              <br />a place to stay.
            </p>
            <span>Keep yours here.</span>
          </div>
        )}
        <div className="sidebar-bottom">
          <NavLink to="/settings">
            <Settings2 size={18} />
            Settings
          </NavLink>
          {user ? (
            <button
              className="sidebar-signout"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              <LogOut size={18} />
              {logout.isPending ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <button
              className="button secondary full"
              onClick={() => {
                setMobileOpen(false);
                setAuthOpen(true);
              }}
            >
              Sign in to your space
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </aside>
      <div className="workspace" inert={mobile && mobileOpen}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              aria-controls="main-sidebar"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span>Your space</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <form
            className="global-search"
            role="search"
            aria-label="Search catalog"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(`/discover?q=${encodeURIComponent(search.trim())}`);
            }}
          >
            <button
              type="submit"
              className="search-submit"
              aria-label="Search catalog"
            >
              <Search size={18} />
            </button>
            <input
              aria-label="Search anime catalog"
              type="search"
              enterKeyHint="search"
              maxLength={200}
              placeholder="Find your next anime…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <kbd aria-hidden="true">↵</kbd>
          </form>
          <span className="topbar-tag">
            <span />
            One episode at a time
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          {session.isError && (
            <ErrorPanel
              error={session.error}
              retry={() => void session.refetch()}
            />
          )}
          {context.libraryError && (
            <ErrorPanel
              error={context.libraryError}
              retry={() => void library.refetch()}
            />
          )}
          {session.isPending ? (
            <div className="route-loading" role="status">
              <LoaderCircle size={25} className="spin" />
              <h1>Loading your space…</h1>
            </div>
          ) : (
            <Routes>
              <Route
                path="/"
                element={user ? <Overview /> : <Navigate to="/login" replace />}
              />
              <Route path="/discover" element={<Discover />} />
              <Route path="/library" element={<Library />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route
                path="*"
                element={
                  <Empty
                    page
                    title="A little off the beaten path"
                    text="This page doesn't exist. Head back to your overview."
                    action={
                      <Link className="button primary" to="/">
                        Go home
                        <ArrowRight size={16} />
                      </Link>
                    }
                  />
                }
              />
            </Routes>
          )}
          <footer className="footer">
            <span>
              AniTrack<span className="coral">.</span> A home for your anime
              journey.
            </span>
            <span>Made for the love of a good story.</span>
          </footer>
        </main>
      </div>
      {authOpen && <AuthDialog close={() => setAuthOpen(false)} />}
      {selected && (
        <DetailDialog anime={selected} close={() => setSelected(null)} />
      )}
      {editing && (
        <EditorDialog anime={editing} close={() => setEditing(null)} />
      )}
      <div
        role={toast?.kind === "error" ? "alert" : "status"}
        aria-live={toast?.kind === "error" ? "assertive" : "polite"}
        className={`toast ${toast ? "visible" : ""} ${toast?.kind === "error" ? "toast-error" : ""}`}
      >
        {toast && (
          <>
            {toast.kind === "error" ? (
              <CircleAlert size={17} />
            ) : (
              <Check size={17} />
            )}
            {toast.message}
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast(null)}
            >
              <X size={15} />
            </button>
          </>
        )}
      </div>
    </AppContext.Provider>
  );
}
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
