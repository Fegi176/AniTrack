using AnimeTracker.Api.Domain;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AnimeTracker.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<AppUser>(options)
{
    public DbSet<Anime> Anime => Set<Anime>();
    public DbSet<LibraryEntry> Library => Set<LibraryEntry>();
    public DbSet<CatalogSnapshot> CatalogSnapshots => Set<CatalogSnapshot>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<Anime>().Property(a => a.Id).ValueGeneratedNever();
        builder.Entity<Anime>().HasIndex(a => a.Title);
        builder.Entity<LibraryEntry>().HasIndex(e => new { e.UserId, e.AnimeId }).IsUnique();
        builder.Entity<LibraryEntry>().Property(e => e.Revision).IsConcurrencyToken();
        builder.Entity<LibraryEntry>().Property(e => e.Status).HasConversion<string>();
        builder.Entity<LibraryEntry>().ToTable(t =>
        {
            t.HasCheckConstraint("CK_Library_Progress", "EpisodesWatched >= 0");
            t.HasCheckConstraint("CK_Library_Score", "Score IS NULL OR (Score >= 1 AND Score <= 10)");
        });
    }
}
