# Catalog data attribution

The catalog is a transformed subset of [anime-offline-database, release 2026-27](https://github.com/manami-project/anime-offline-database/releases/tag/2026-27), published by the manami project on July 4, 2026.

The database is provided under the **Open Data Commons Open Database License (ODbL) v1.0** and **Database Contents License (DbCL) v1.0**. The upstream license is reproduced in `LICENSE.catalog.txt`. The derived `catalog.json` database is made available under those same terms. This data license does not set the license of the application code or grant rights to externally hosted poster artwork.

`catalog-info.json` records the release URL, update date, record count, source SHA-256, and generated catalog version. `scripts/build-catalog.mjs` reproduces the transformation. It retains titles with a MyAnimeList ID and a TV, Movie, OVA, ONA, or Special format. Explicit adult categories are excluded using upstream tags. Broad genre labels are mapped from tags; alternative titles support search. Scores are upstream aggregate scores rounded to two decimal places; upcoming releases are shown as unrated. Runtime is rounded to whole minutes and remains unknown when absent. External image URLs are references, not bundled image files.

The original short summaries and display-title overrides for a small set of featured titles are kept in `catalog-editorial.json`. This reviewed editorial set is retained when a noisy upstream content-theme tag would otherwise exclude a title. The API seeder and search endpoint use the same Unicode normalization for alternate titles. Missing synopses and other metadata are shown as unavailable; they are not invented.
