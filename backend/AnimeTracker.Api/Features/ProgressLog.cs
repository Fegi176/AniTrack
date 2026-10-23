using AnimeTracker.Api.Data;
using AnimeTracker.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace AnimeTracker.Api.Features;

public static class ProgressLog
{
    public sealed record Snapshot(WatchStatus Status, int Episodes, int? Score, string Notes);
    public static Snapshot Read(LibraryEntry entry) => new(entry.Status, entry.EpisodesWatched, entry.Score, entry.Notes);

    public static void Record(AppDbContext db, LibraryEntry entry, Snapshot? before, bool removed = false)
    {
        var after = removed ? null : Read(entry);
        if (before == after) return;
        db.Activities.Add(new LibraryActivity
        {
            UserId = entry.UserId,
            AnimeId = entry.AnimeId,
            Title = entry.Anime.Title,
            Kind = removed ? ActivityKind.Removed : before is null ? ActivityKind.Added : ActivityKind.Updated,
            FromStatus = before?.Status,
            ToStatus = after?.Status,
            FromEpisodes = before?.Episodes,
            ToEpisodes = after?.Episodes,
            FromScore = before?.Score,
            ToScore = after?.Score,
            NotesChanged = before is not null && after is not null && before.Notes != after.Notes
        });
    }

    // A library write, its history, and newly earned milestones commit together.
    public static async Task SaveAsync(AppDbContext db, string userId)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.SaveChangesAsync();
        await Milestones.AwardAsync(db, userId);
        await transaction.CommitAsync();
    }
}

public static class Milestones
{
    public sealed record Definition(string Code, string Title, string Description, string Metric, int Target);
    public static readonly Definition[] Definitions =
    [
        new("first-title", "A new chapter", "Save your first anime to your library.", "titles", 1),
        new("shelf-builder", "Room for more", "Save 10 anime to your library.", "titles", 10),
        new("first-finish", "The final episode", "Complete your first anime.", "completed", 1),
        new("ten-finishes", "Stories to remember", "Complete 10 anime.", "completed", 10),
        new("hundred-episodes", "One more episode", "Log 100 watched episodes.", "episodes", 100),
        new("thousand-episodes", "A thousand moments", "Log 1,000 watched episodes.", "episodes", 1000),
        new("five-ratings", "Finding your taste", "Rate 5 anime in your library.", "rated", 5),
        new("genre-explorer", "Beyond your usual", "Complete anime spanning 5 different genres.", "genres", 5),
        new("movie-night", "Movie night", "Complete an anime movie.", "movies", 1)
    ];

    public static async Task<Dictionary<string, long>> MeasureAsync(AppDbContext db, string userId)
    {
        var entries = await db.Library.AsNoTracking().Where(e => e.UserId == userId)
            .Select(e => new { e.Status, e.EpisodesWatched, e.Score, e.Anime.Genres, e.Anime.Format }).ToListAsync();
        var completed = entries.Where(e => e.Status == WatchStatus.Completed).ToList();
        return new()
        {
            ["titles"] = entries.Count,
            ["completed"] = completed.Count,
            ["episodes"] = entries.Sum(e => (long)e.EpisodesWatched),
            ["rated"] = entries.Count(e => e.Score.HasValue),
            ["genres"] = completed.SelectMany(e => e.Genres.Split('|', StringSplitOptions.RemoveEmptyEntries)).Distinct().Count(),
            ["movies"] = completed.Count(e => e.Format == "Movie")
        };
    }

    public static async Task AwardAsync(AppDbContext db, string userId)
    {
        var progress = await MeasureAsync(db, userId);
        var earned = await db.Achievements.Where(a => a.UserId == userId).Select(a => a.Code).ToHashSetAsync();
        foreach (var definition in Definitions)
            if (!earned.Contains(definition.Code) && progress[definition.Metric] >= definition.Target)
                db.Achievements.Add(new UserAchievement { UserId = userId, Code = definition.Code });
        await db.SaveChangesAsync();
    }

    public static async Task RecognizeExistingAsync(AppDbContext db)
    {
        // Recognize saved progress today; never fabricate past viewing events or unlock dates.
        var userIds = await db.Library.Select(e => e.UserId).Distinct().ToListAsync();
        foreach (var userId in userIds) await AwardAsync(db, userId);
    }
}
