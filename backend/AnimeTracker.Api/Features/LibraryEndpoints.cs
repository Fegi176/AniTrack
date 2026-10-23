using AnimeTracker.Api.Data;
using AnimeTracker.Api.Domain;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AnimeTracker.Api.Features;

public static class LibraryEndpoints
{
    public static void MapLibraryEndpoints(this WebApplication app)
    {
        var library = app.MapGroup("/api/library").RequireAuthorization().WithTags("Library");
        library.MapGet("/", async (ClaimsPrincipal user, AppDbContext db) =>
        {
            var id = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var entries = await db.Library.AsNoTracking().Include(e => e.Anime).Where(e => e.UserId == id)
                .OrderByDescending(e => e.UpdatedAt).ToListAsync();
            return Results.Ok(entries.Select(e => e.ToResponse()));
        });
        library.MapPut("/{animeId:int}", async (int animeId, LibraryRequest request, ClaimsPrincipal user, AppDbContext db) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var anime = await db.Anime.FindAsync(animeId);
            if (anime is null) return Results.NotFound();
            if (request.Validate(anime) is { } error) return Results.Problem(error, statusCode: 400);
            var entry = await db.Library.Include(e => e.Anime).FirstOrDefaultAsync(e => e.UserId == userId && e.AnimeId == animeId);
            if ((entry is not null && entry.Revision != request.Revision) || (entry is null && request.Revision.HasValue))
                return Conflict();
            var before = entry is null ? null : ProgressLog.Read(entry);
            if (entry is null)
            {
                entry = new LibraryEntry { UserId = userId, AnimeId = animeId, Anime = anime };
                db.Library.Add(entry);
            }
            entry.Apply(request, anime);
            ProgressLog.Record(db, entry, before);
            try { await ProgressLog.SaveAsync(db, userId); }
            catch (DbUpdateConcurrencyException) { return Conflict(); }
            catch (DbUpdateException ex) when (ex.InnerException is Microsoft.Data.Sqlite.SqliteException { SqliteErrorCode: 19 }) { return Conflict(); }
            return Results.Ok(entry.ToResponse());
        });
        library.MapDelete("/{animeId:int}", async (int animeId, Guid revision, ClaimsPrincipal user, AppDbContext db) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var entry = await db.Library.Include(e => e.Anime).FirstOrDefaultAsync(e => e.UserId == userId && e.AnimeId == animeId);
            if (entry is null) return Results.NotFound();
            if (entry.Revision != revision) return Conflict();
            ProgressLog.Record(db, entry, ProgressLog.Read(entry), removed: true);
            db.Library.Remove(entry);
            try { await ProgressLog.SaveAsync(db, userId); }
            catch (DbUpdateConcurrencyException) { return Conflict(); }
            return Results.NoContent();
        });

        app.MapGet("/api/insights", async (ClaimsPrincipal user, AppDbContext db) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var entries = await db.Library.AsNoTracking().Include(e => e.Anime).Where(e => e.UserId == userId).ToListAsync();
            var rated = entries.Where(e => e.Score.HasValue).ToList();
            var genres = entries.SelectMany(e => e.Anime.Genres.Split('|')).Where(g => g.Length > 0)
                .GroupBy(g => g).Select(g => new { name = g.Key, count = g.Count() }).OrderByDescending(g => g.count).ThenBy(g => g.name).Take(6);
            return Results.Ok(new
            {
                totalTitles = entries.Count,
                episodesWatched = entries.Sum(e => (long)e.EpisodesWatched),
                hoursWatched = Math.Round(entries.Sum(e => (long)e.EpisodesWatched * e.Anime.EpisodeMinutes) / 60.0, 1),
                unknownRuntimeTitles = entries.Count(e => e.EpisodesWatched > 0 && e.Anime.EpisodeMinutes == 0),
                meanScore = rated.Count == 0 ? (double?)null : Math.Round(rated.Average(e => e.Score!.Value), 1),
                statuses = Enum.GetValues<WatchStatus>().Select(s => new { status = s, count = entries.Count(e => e.Status == s) }),
                genres,
                ratings = Enumerable.Range(1, 10).Select(s => new { score = s, count = rated.Count(e => e.Score == s) }),
                recent = entries.OrderByDescending(e => e.UpdatedAt).Take(5).Select(e => e.ToResponse())
            });
        }).RequireAuthorization().WithTags("Insights");
    }

    private static IResult Conflict() => Results.Problem("This entry changed in another tab. Refresh the library and try again.", statusCode: 409);
}
