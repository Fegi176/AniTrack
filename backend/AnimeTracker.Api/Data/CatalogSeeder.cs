using System.Text.Json;
using AnimeTracker.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace AnimeTracker.Api.Data;

public static class CatalogSeeder
{
    public static async Task UpdateAsync(AppDbContext db, string contentRoot, ILogger logger)
    {
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var directory = Path.Combine(contentRoot, "Data");
        var snapshot = JsonSerializer.Deserialize<CatalogSnapshot>(await File.ReadAllTextAsync(Path.Combine(directory, "catalog-info.json")), options)!;
        var previous = await db.CatalogSnapshots.FirstOrDefaultAsync(s => s.Id == 1);
        if (previous?.Version == snapshot.Version) return;
        var catalog = JsonSerializer.Deserialize<List<Anime>>(await File.ReadAllTextAsync(Path.Combine(directory, "catalog.json")), options)!;
        var existing = await db.Anime.ToDictionaryAsync(a => a.Id);
        foreach (var anime in catalog)
        {
            anime.AlternativeTitles = SearchNormalization.Normalize(anime.AlternativeTitles);
            if (existing.TryGetValue(anime.Id, out var stored)) db.Entry(stored).CurrentValues.SetValues(anime);
            else db.Anime.Add(anime);
        }
        // User library rows and any previously referenced catalog titles are preserved.
        snapshot.TitleCount = existing.Keys.Union(catalog.Select(a => a.Id)).Count();
        if (previous is null) db.CatalogSnapshots.Add(snapshot);
        else db.Entry(previous).CurrentValues.SetValues(snapshot);
        await db.SaveChangesAsync();
        logger.LogInformation("Catalog updated to {Version}: {TitleCount} titles.", snapshot.LastUpdated, snapshot.TitleCount);
    }
}
