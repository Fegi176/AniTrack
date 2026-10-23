# Rebuild decisions

Source reference: [Fegi176/MusicQuiz](https://github.com/Fegi176/MusicQuiz), inspected at `8c5bcaf` (`feat(upgrades+ afk production)`). The repository already used React/TypeScript and an Express/SQLite backend. Its checked-in feature set was an anime tracker with character/gacha/facility systems, despite the repository name.

The requested direction is a portfolio project using React and .NET, removing character collection and improving the remaining anime application. The source checkout is kept separately from this rebuild.

| Area | Source behavior observed | AniTrack implementation |
| --- | --- | --- |
| Backend | Express routes with SQL and business logic mixed together | ASP.NET Core feature endpoints, typed contracts, EF Core migrations |
| Product | Anime catalog plus collecting, coins, banners, facilities | Anime discovery, watchlist, profile, insights, XML portability |
| API access | Hardcoded localhost URLs across components | One HTTP client and a same-origin `/api` boundary |
| Account sessions | Custom JWT handling with a default signing-secret fallback | Identity cookie sessions, CSRF protection, lockout and rate limiting |
| Watchlists | Anime status, score, watched episodes | Validated tracking plus notes, completion rules, revision conflicts |
| Statistics | Placeholder profile statistics | Aggregates calculated from each user's persisted entries |
| History and achievements | Placeholder tabs | Transactional private activity history and nine permanent, server-calculated milestones |
| Import | MyAnimeList XML upload path | Bounded XML parsing, validation, skipped counts, and compatible export |
| Setup | Missing catalog/media assets in the checkout | Attributed 28,302-title catalog snapshot, reproducible import, and graceful remote image fallbacks |
| Reviewability | No automated tests or root setup guide in the inspected checkout | API integration tests, browser journeys, run instructions, architecture, CI |

## Delivered first version

The review path is: browse without signing in → create an account or use the local demo → add a title → update its progress and rating → finish it → view statistics → export/import the list.

The new app does not carry over the original character schemas, currencies, gacha odds, resource production, or adult-themed facility data. It is implemented independently in this folder; no destructive migration is performed against the source project's database.

## Useful next increments

1. A scheduled catalog sync behind a provider interface, including caching, rate limits, retries, and a catalog update timestamp.
2. Email verification and password recovery with a real email provider.
3. Catalog administration with explicit role authorization and audit history.
4. Recommendations based on completed and highly rated titles, with explanations of why a title was selected.
5. Dedicated rewatch sessions and historical charts with clear distinctions between logged activity and imported progress.

These are extensions, not features claimed by the current application. A focused, tested demo is the starting point for the portfolio.
