using AnimeTracker.Api.Domain;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AnimeTracker.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<AppUser>(options)
{
    public DbSet<Anime> Anime => Set<Anime>();
    public DbSet<LibraryEntry> Library => Set<LibraryEntry>();
    public DbSet<CatalogSnapshot> CatalogSnapshots => Set<CatalogSnapshot>();
    public DbSet<LibraryActivity> Activities => Set<LibraryActivity>();
    public DbSet<UserAchievement> Achievements => Set<UserAchievement>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<LibraryActivity>().HasIndex(a => new { a.UserId, a.OccurredAt, a.Id });
        builder.Entity<LibraryActivity>().Property(a => a.Kind).HasConversion<string>();
        builder.Entity<LibraryActivity>().Property(a => a.FromStatus).HasConversion<string>();
        builder.Entity<LibraryActivity>().Property(a => a.ToStatus).HasConversion<string>();
        builder.Entity<LibraryActivity>().HasOne(a => a.User).WithMany().HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.Entity<UserAchievement>().HasKey(a => new { a.UserId, a.Code });
        builder.Entity<UserAchievement>().Property(a => a.Code).HasMaxLength(64);
        builder.Entity<UserAchievement>().HasOne(a => a.User).WithMany().HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Cascade);
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
