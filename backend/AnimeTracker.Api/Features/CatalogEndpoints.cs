using AnimeTracker.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace AnimeTracker.Api.Features;

public static class CatalogEndpoints
{
    public static void MapCatalogEndpoints(this WebApplication app)
    {
        var catalog = app.MapGroup("/api/catalog").WithTags("Catalog");
        catalog.MapGet("/", async (AppDbContext db, string? search, string? genre, string? format, string? sort, int? page, int? pageSize, int? year) =>
        {
            var query = db.Anime.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = SearchNormalization.Normalize(search.Trim());
                query = query.Where(a => a.Title.ToUpper().Contains(term) || a.OriginalTitle.ToUpper().Contains(term) || a.AlternativeTitles.Contains(term));
            }
            if (!string.IsNullOrWhiteSpace(genre)) query = query.Where(a => ("|" + a.Genres + "|").Contains("|" + genre + "|"));
            if (!string.IsNullOrWhiteSpace(format)) query = query.Where(a => a.Format == format);
            if (year.HasValue) query = query.Where(a => a.Year == year);
            query = sort switch
            {
                "newest" => query.OrderByDescending(a => a.Year).ThenByDescending(a => a.CommunityScore).ThenBy(a => a.Id),
                "title" => query.OrderBy(a => a.Title).ThenBy(a => a.Id),
                "score" => query.OrderByDescending(a => a.CommunityScore).ThenBy(a => a.Id),
                _ => query.OrderBy(a => a.FeaturedOrder == 0 ? 1 : 0).ThenBy(a => a.FeaturedOrder)
                    .ThenByDescending(a => a.CommunityScore).ThenBy(a => a.Id)
            };
            var total = await query.CountAsync();
            var size = Math.Clamp(pageSize ?? 12, 1, 48);
            var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)size));
            var currentPage = Math.Clamp(page ?? 1, 1, totalPages);
            var items = await query.Skip((int)Math.Min((long)(currentPage - 1) * size, int.MaxValue)).Take(size).ToListAsync();
            return Results.Ok(new { items = items.Select(a => a.ToResponse()), total, page = currentPage, pageSize = size, totalPages });
        });
        catalog.MapGet("/filters", async (AppDbContext db, IMemoryCache cache) =>
        {
            var filters = await cache.GetOrCreateAsync("catalog-filters", async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1);
                var all = await db.Anime.AsNoTracking().Select(a => new { a.Genres, a.Format, a.Year }).ToListAsync();
                return new CatalogFiltersResponse(
                    all.SelectMany(a => a.Genres.Split('|')).Where(g => g.Length > 0).Distinct().Order().ToArray(),
                    all.Select(a => a.Format).Distinct().Order().ToArray(),
                    all.Select(a => a.Year).Where(y => y > 0).Distinct().OrderDescending().ToArray());
            });
            return Results.Ok(filters);
        });
        catalog.MapGet("/info", async (AppDbContext db) => Results.Ok(await db.CatalogSnapshots.AsNoTracking().FirstAsync(s => s.Id == 1)));
        catalog.MapGet("/{id:int}", async (int id, AppDbContext db) =>
            await db.Anime.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id) is { } anime
                ? Results.Ok(anime.ToResponse()) : Results.NotFound());
    }
}
