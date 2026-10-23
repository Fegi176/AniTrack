using System.Security.Claims;
using AnimeTracker.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace AnimeTracker.Api.Features;

public static class ProgressEndpoints
{
    public static void MapProgressEndpoints(this WebApplication app)
    {
        app.MapGet("/api/history", async (ClaimsPrincipal user, AppDbContext db, int? page) =>
        {
            const int pageSize = 20;
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var query = db.Activities.AsNoTracking().Where(a => a.UserId == userId);
            var total = await query.CountAsync();
            var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));
            var currentPage = Math.Clamp(page ?? 1, 1, totalPages);
            var rows = await query.OrderByDescending(a => a.OccurredAt).ThenByDescending(a => a.Id)
                .Skip((currentPage - 1) * pageSize).Take(pageSize).ToListAsync();
            var items = rows.Select(a => new
            {
                a.Id,
                a.AnimeId,
                a.Title,
                a.Kind,
                a.FromStatus,
                a.ToStatus,
                a.FromEpisodes,
                a.ToEpisodes,
                a.FromScore,
                a.ToScore,
                a.NotesChanged,
                a.ImportedAdded,
                a.ImportedUpdated,
                a.ImportedSkipped,
                occurredAt = DateTime.SpecifyKind(a.OccurredAt, DateTimeKind.Utc)
            }).ToList();
            return Results.Ok(new { items, total, page = currentPage, pageSize, totalPages });
        }).RequireAuthorization().WithTags("History");

        app.MapGet("/api/achievements", async (ClaimsPrincipal user, AppDbContext db) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var progress = await Milestones.MeasureAsync(db, userId);
            var earned = await db.Achievements.AsNoTracking().Where(a => a.UserId == userId).ToDictionaryAsync(a => a.Code, a => a.UnlockedAt);
            var items = Milestones.Definitions.Select(d => new
            {
                d.Code,
                d.Title,
                d.Description,
                d.Target,
                progress = earned.ContainsKey(d.Code) ? d.Target : Math.Min(progress[d.Metric], d.Target),
                unlockedAt = earned.TryGetValue(d.Code, out var date) ? DateTime.SpecifyKind(date, DateTimeKind.Utc) : (DateTime?)null
            }).ToList();
            return Results.Ok(new { items, unlocked = items.Count(a => a.unlockedAt.HasValue), total = items.Count });
        }).RequireAuthorization().WithTags("Achievements");
    }
}
