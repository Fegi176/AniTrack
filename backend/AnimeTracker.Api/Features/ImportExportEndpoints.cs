using AnimeTracker.Api.Data;
using AnimeTracker.Api.Domain;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Xml;
using System.Xml.Linq;

namespace AnimeTracker.Api.Features;

public static class ImportExportEndpoints
{
    public static void MapImportExportEndpoints(this WebApplication app)
    {
        app.MapGet("/api/library/export", async (ClaimsPrincipal user, AppDbContext db) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var entries = await db.Library.AsNoTracking().Include(e => e.Anime).Where(e => e.UserId == userId).ToListAsync();
            var document = new XDocument(new XDeclaration("1.0", "utf-8", null), new XElement("myanimelist",
                entries.Select(e => new XElement("anime",
                    new XElement("series_animedb_id", e.AnimeId), new XElement("series_title", e.Anime.Title),
                    new XElement("series_episodes", e.Anime.Episodes), new XElement("my_watched_episodes", e.EpisodesWatched),
                    new XElement("my_score", e.Score ?? 0), new XElement("my_status", ToMalStatus(e.Status)),
                    new XElement("my_comments", e.Notes)))));
            return Results.File(Encoding.UTF8.GetBytes(document.ToString()), "application/xml", "animetrack-library.xml");
        }).RequireAuthorization().WithTags("Import and export");

        app.MapPost("/api/library/import", async (HttpRequest request, ClaimsPrincipal user, AppDbContext db) =>
        {
            const int maximumBytes = 2 * 1024 * 1024;
            if (request.ContentLength > maximumBytes)
                return Results.Problem("The XML file must be smaller than 2 MB.", statusCode: 400);
            using var buffer = new MemoryStream();
            var chunk = new byte[8192];
            int read;
            while ((read = await request.Body.ReadAsync(chunk)) > 0)
            {
                if (buffer.Length + read > maximumBytes)
                    return Results.Problem("The XML file must be smaller than 2 MB.", statusCode: 400);
                buffer.Write(chunk, 0, read);
            }
            buffer.Position = 0;
            XDocument document;
            try
            {
                using var reader = XmlReader.Create(buffer, new XmlReaderSettings
                { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = maximumBytes });
                document = XDocument.Load(reader);
            }
            catch (XmlException) { return Results.Problem("This is not a valid MyAnimeList XML export.", statusCode: 400); }
            if (document.Root?.Name.LocalName != "myanimelist")
                return Results.Problem("Expected a MyAnimeList XML export.", statusCode: 400);

            var rows = document.Root.Elements("anime").ToList();
            if (rows.Count > 10000) return Results.Problem("Import supports up to 10,000 entries.", statusCode: 400);
            var catalog = await db.Anime.ToDictionaryAsync(a => a.Id);
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var library = await db.Library.Where(e => e.UserId == userId).ToDictionaryAsync(e => e.AnimeId);
            var updated = 0;
            var added = 0;
            var skipped = 0;
            var seen = new HashSet<int>();
            foreach (var row in rows)
            {
                if (!int.TryParse(row.Element("series_animedb_id")?.Value, out var animeId) ||
                    !catalog.TryGetValue(animeId, out var anime) || !seen.Add(animeId)) { skipped++; continue; }
                var status = FromMalStatus(row.Element("my_status")?.Value);
                if (status is null || !int.TryParse(row.Element("my_watched_episodes")?.Value ?? "0", NumberStyles.Integer, CultureInfo.InvariantCulture, out var episodes) ||
                    !int.TryParse(row.Element("my_score")?.Value ?? "0", out var score) || score is < 0 or > 10)
                    return Results.Problem($"Invalid progress, score, or status for {anime.Title}. Nothing was imported.", statusCode: 400);
                var notes = row.Element("my_comments")?.Value ?? (library.TryGetValue(animeId, out var old) ? old.Notes : "");
                var input = new LibraryRequest(status.Value, episodes, score == 0 ? null : score, notes, null);
                if (input.Validate(anime) is { } error)
                    return Results.Problem($"{anime.Title}: {error} Nothing was imported.", statusCode: 400);
                if (!library.TryGetValue(animeId, out var entry))
                {
                    entry = new LibraryEntry { UserId = userId, AnimeId = animeId };
                    db.Library.Add(entry);
                    library[animeId] = entry;
                    added++;
                }
                else updated++;
                entry.Apply(input, anime);
            }
            try { await db.SaveChangesAsync(); }
            catch (DbUpdateException)
            { return Results.Problem("Your library changed during import. Refresh and try again.", statusCode: 409); }
            var imported = added + updated;
            var message = $"Imported {imported} {(imported == 1 ? "title" : "titles")}: {added} new, {updated} updated.";
            if (skipped > 0) message += $" Skipped {skipped} {(skipped == 1 ? "entry" : "entries")} with a duplicate or unsupported ID.";
            return Results.Ok(new { added, updated, skipped, message });
        }).RequireAuthorization().WithTags("Import and export");
    }

    private static string ToMalStatus(WatchStatus status) => status switch
    { WatchStatus.Watching => "Watching", WatchStatus.Completed => "Completed", WatchStatus.OnHold => "On-Hold", WatchStatus.Dropped => "Dropped", _ => "Plan to Watch" };
    private static WatchStatus? FromMalStatus(string? status) => status?.Trim().ToLowerInvariant() switch
    {
        "1" or "watching" => WatchStatus.Watching,
        "2" or "completed" => WatchStatus.Completed,
        "3" or "on-hold" or "on hold" => WatchStatus.OnHold,
        "4" or "dropped" => WatchStatus.Dropped,
        "6" or "plan to watch" => WatchStatus.PlanToWatch,
        _ => null
    };
}
