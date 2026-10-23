import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, X } from "lucide-react";
import { api } from "../api";
import type { Catalog, CatalogInfo, Filters } from "../types";
import { counted, number, positiveInteger, snapshotDate } from "../format";
import {
  AnimeCard,
  Empty,
  ErrorPanel,
  PageHeading,
  Skeletons,
} from "../components/ui";
import { Pagination } from "../components/Pagination";

export function Discover() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q")?.trim() ?? "";
  const genre = params.get("genre") ?? "";
  const requestedPage = positiveInteger(params.get("page"));
  const pageSize = [12, 24, 48].includes(Number(params.get("size")))
    ? Number(params.get("size"))
    : 12;
  const sort = ["recommended", "score", "newest", "title"].includes(
    params.get("sort") ?? "",
  )
    ? params.get("sort")!
    : "recommended";
  const filters = useQuery({
    queryKey: ["filters"],
    queryFn: () => api<Filters>("/catalog/filters"),
  });
  const info = useQuery({
    queryKey: ["catalog-info"],
    queryFn: () => api<CatalogInfo>("/catalog/info"),
  });
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  };
  const query = new URLSearchParams({
    search: q,
    genre,
    format: params.get("format") ?? "",
    sort,
    page: String(requestedPage),
    pageSize: String(pageSize),
  });
  const year = positiveInteger(params.get("year"), 0);
  if (year) query.set("year", String(year));
  const catalog = useQuery({
    queryKey: ["catalog", query.toString()],
    queryFn: () => api<Catalog>(`/catalog?${query}`),
  });
  const page = catalog.data?.page ?? requestedPage;
  const totalPages = catalog.data?.totalPages ?? 1;
  const hasFilters = !!(q || genre || params.get("format") || year);
  const changePage = (nextPage: number) => {
    const next = new URLSearchParams(params);
    if (nextPage === 1) next.delete("page");
    else next.set("page", String(nextPage));
    setParams(next);
    document.getElementById("catalog-results")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  };
  return (
    <>
      <PageHeading
        eyebrow="FOLLOW YOUR CURIOSITY"
        title="A world of stories."
        text="Find your next anime by title, genre, or the worlds you love."
      />
      <form
        className="catalog-search"
        role="search"
        aria-label="Discover anime"
        onSubmit={(event) => {
          event.preventDefault();
          setFilter(
            "q",
            String(
              new FormData(event.currentTarget).get("search") ?? "",
            ).trim(),
          );
        }}
      >
        <Search size={21} />
        <input
          key={q}
          name="search"
          aria-label="Search titles"
          type="search"
          enterKeyHint="search"
          placeholder="Search titles, including English and Japanese names…"
          defaultValue={q}
          maxLength={200}
        />
        <button className="button primary" type="submit">
          Search
          <ArrowRight size={17} />
        </button>
      </form>
      <div className="genre-chips" aria-label="Quick genre filters">
        {[
          "",
          "Action",
          "Adventure",
          "Fantasy",
          "Drama",
          "Comedy",
          "Romance",
          "Sci-Fi",
        ].map((value) => (
          <button
            key={value}
            className={`chip ${genre === value ? "selected" : ""}`}
            aria-pressed={genre === value}
            onClick={() => setFilter("genre", value)}
          >
            {value || "All genres"}
          </button>
        ))}
      </div>
      {filters.isError && (
        <ErrorPanel
          error={filters.error}
          retry={() => void filters.refetch()}
        />
      )}
      <div className="filter-row" id="catalog-results">
        <div className="result-count" role="status" aria-live="polite">
          {catalog.isPending ? (
            "Finding anime…"
          ) : catalog.isError ? (
            "Results unavailable"
          ) : (
            <>
              <strong>{counted(catalog.data.total, "title")}</strong>
              <span>
                {catalog.data.total > 0
                  ? `${number((page - 1) * pageSize + 1)}–${number(Math.min(page * pageSize, catalog.data.total))} shown`
                  : "Try a broader search"}
              </span>
            </>
          )}
        </div>
        <div className="catalog-filters">
          <label>
            Genre
            <select
              aria-label="Genre"
              value={genre}
              onChange={(event) => setFilter("genre", event.target.value)}
            >
              <option value="">All genres</option>
              {filters.data?.genres.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Format
            <select
              aria-label="Format"
              value={params.get("format") ?? ""}
              onChange={(event) => setFilter("format", event.target.value)}
            >
              <option value="">All formats</option>
              {filters.data?.formats.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Year
            <select
              aria-label="Release year"
              value={year || ""}
              onChange={(event) => setFilter("year", event.target.value)}
            >
              <option value="">All years</option>
              {filters.data?.years.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Sort by
            <select
              aria-label="Sort catalog"
              value={sort}
              onChange={(event) => setFilter("sort", event.target.value)}
            >
              <option value="recommended">Editor's picks</option>
              <option value="score">Highest rated</option>
              <option value="newest">Newest first</option>
              <option value="title">Title A–Z</option>
            </select>
          </label>
          <label>
            Per page
            <select
              aria-label="Titles per page"
              value={pageSize}
              onChange={(event) => setFilter("size", event.target.value)}
            >
              {[12, 24, 48].map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {hasFilters && (
        <div className="active-filters">
          {q && <span>Search: “{q}”</span>}
          <button className="text-link" onClick={() => setParams({})}>
            <X size={14} />
            Clear filters
          </button>
        </div>
      )}
      {catalog.isPending ? (
        <Skeletons count={pageSize} />
      ) : catalog.isError ? (
        <ErrorPanel
          error={catalog.error}
          retry={() => void catalog.refetch()}
        />
      ) : catalog.data.items.length ? (
        <div className="anime-grid">
          {catalog.data.items.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </div>
      ) : (
        <Empty
          title="No anime found."
          text="Try a different title or remove a filter to explore more of the catalog."
          action={
            <button className="button secondary" onClick={() => setParams({})}>
              Clear filters
            </button>
          }
        />
      )}
      {!catalog.isError && !catalog.isPending && catalog.data.total > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          changePage={changePage}
        />
      )}
      {info.data && (
        <p className="catalog-attribution">
          Catalog metadata from{" "}
          <a href={info.data.sourceUrl} target="_blank" rel="noreferrer">
            {info.data.sourceName}
          </a>{" "}
          · Snapshot {snapshotDate(info.data.lastUpdated)} ·{" "}
          <a href={info.data.licenseUrl} target="_blank" rel="noreferrer">
            ODbL 1.0 / DbCL 1.0
          </a>
        </p>
      )}
    </>
  );
}
