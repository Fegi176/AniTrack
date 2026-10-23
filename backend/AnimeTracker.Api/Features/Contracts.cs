using AnimeTracker.Api.Domain;

namespace AnimeTracker.Api.Features;

public sealed record Credentials(string Username, string Password);
public sealed record RegisterRequest(string Username, string Password, string DisplayName);
public sealed record ProfileRequest(string DisplayName, string Bio);
public sealed record LibraryRequest(WatchStatus Status, int EpisodesWatched, int? Score, string Notes, Guid? Revision);
public sealed record UserResponse(string Id, string Username, string DisplayName, string Bio, DateTime CreatedAt, bool IsDemo, string? AvatarUrl);
public sealed record AnimeResponse(int Id, string Title, string OriginalTitle, string Synopsis, string PosterUrl,
    string[] Genres, string Studio, string Format, int Year, int Episodes, int EpisodeMinutes, double CommunityScore, bool Airing, string SourceUrl);
public sealed record CatalogFiltersResponse(string[] Genres, string[] Formats, int[] Years);
public sealed record LibraryResponse(int AnimeId, AnimeResponse Anime, WatchStatus Status, int EpisodesWatched,
    int? Score, string Notes, Guid Revision, DateTime UpdatedAt);

public static class Mapping
{
    public static UserResponse ToResponse(this AppUser user) =>
        new(user.Id, user.UserName!, user.DisplayName, user.Bio, user.CreatedAt, user.IsDemo,
            user.AvatarVersion is null ? null : $"/api/profile/avatar/{user.Id}/{user.AvatarVersion}");
    public static AnimeResponse ToResponse(this Anime anime) => new(anime.Id, anime.Title, anime.OriginalTitle,
        anime.Synopsis, anime.PosterUrl, anime.Genres.Split('|', StringSplitOptions.RemoveEmptyEntries),
        anime.Studio, anime.Format, anime.Year, anime.Episodes, anime.EpisodeMinutes, anime.CommunityScore, anime.Airing, anime.SourceUrl);
    public static LibraryResponse ToResponse(this LibraryEntry entry) => new(entry.AnimeId, entry.Anime.ToResponse(),
        entry.Status, entry.EpisodesWatched, entry.Score, entry.Notes, entry.Revision, entry.UpdatedAt);

    public static string? Validate(this LibraryRequest request, Anime anime)
    {
        if (!Enum.IsDefined(request.Status)) return "Choose a valid watch status.";
        if (request.EpisodesWatched < 0 || request.EpisodesWatched > (anime.Episodes > 0 ? anime.Episodes : 100000))
            return "Episode progress must be within the title's episode count.";
        if (request.Score is < 1 or > 10) return "Rating must be between 1 and 10.";
        if (request.Notes is null || request.Notes.Length > 2000) return "Notes must be at most 2,000 characters.";
        return null;
    }

    public static void Apply(this LibraryEntry entry, LibraryRequest request, Anime anime)
    {
        entry.Status = request.Status;
        entry.EpisodesWatched = request.Status == WatchStatus.PlanToWatch ? 0 :
            request.Status == WatchStatus.Completed && anime.Episodes > 0 ? anime.Episodes : request.EpisodesWatched;
        if (anime.Episodes > 0 && entry.EpisodesWatched == anime.Episodes) entry.Status = WatchStatus.Completed;
        entry.Score = request.Score;
        entry.Notes = request.Notes.Trim();
        entry.Revision = Guid.NewGuid();
        entry.UpdatedAt = DateTime.UtcNow;
    }
}
