using Microsoft.AspNetCore.Identity;

namespace AnimeTracker.Api.Domain;

public sealed class AppUser : IdentityUser
{
    public bool IsDemo { get; set; }
    public string DisplayName { get; set; } = "";
    public string Bio { get; set; } = "";
    public byte[]? Avatar { get; set; }
    public string? AvatarVersion { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class Anime
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string OriginalTitle { get; set; } = "";
    public string AlternativeTitles { get; set; } = "";
    public string SourceUrl { get; set; } = "";
    public int FeaturedOrder { get; set; }
    public string Synopsis { get; set; } = "";
    public string PosterUrl { get; set; } = "";
    public string Genres { get; set; } = "";
    public string Studio { get; set; } = "";
    public string Format { get; set; } = "TV";
    public int Year { get; set; }
    public int Episodes { get; set; }
    public int EpisodeMinutes { get; set; } = 24;
    public double CommunityScore { get; set; }
    public bool Airing { get; set; }
}

public enum WatchStatus { Watching, Completed, PlanToWatch, OnHold, Dropped }

public enum ActivityKind { Added, Updated, Removed, Imported }

public sealed class LibraryActivity
{
    public long Id { get; set; }
    public string UserId { get; set; } = "";
    public AppUser User { get; set; } = null!;
    public int? AnimeId { get; set; }
    public string Title { get; set; } = "";
    public ActivityKind Kind { get; set; }
    public WatchStatus? FromStatus { get; set; }
    public WatchStatus? ToStatus { get; set; }
    public int? FromEpisodes { get; set; }
    public int? ToEpisodes { get; set; }
    public int? FromScore { get; set; }
    public int? ToScore { get; set; }
    public bool NotesChanged { get; set; }
    public int ImportedAdded { get; set; }
    public int ImportedUpdated { get; set; }
    public int ImportedSkipped { get; set; }
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
}

public sealed class UserAchievement
{
    public string UserId { get; set; } = "";
    public AppUser User { get; set; } = null!;
    public string Code { get; set; } = "";
    public DateTime UnlockedAt { get; set; } = DateTime.UtcNow;
}

public sealed class CatalogSnapshot
{
    public int Id { get; set; } = 1;
    public string Version { get; set; } = "";
    public string SourceName { get; set; } = "";
    public string SourceUrl { get; set; } = "";
    public string LastUpdated { get; set; } = "";
    public string LicenseName { get; set; } = "";
    public string LicenseUrl { get; set; } = "";
    public int TitleCount { get; set; }
}

public sealed class LibraryEntry
{
    public int Id { get; set; }
    public string UserId { get; set; } = "";
    public AppUser User { get; set; } = null!;
    public int AnimeId { get; set; }
    public Anime Anime { get; set; } = null!;
    public WatchStatus Status { get; set; } = WatchStatus.PlanToWatch;
    public int EpisodesWatched { get; set; }
    public int? Score { get; set; }
    public string Notes { get; set; } = "";
    public Guid Revision { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
