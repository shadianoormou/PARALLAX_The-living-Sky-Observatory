using Microsoft.EntityFrameworkCore;
using Parallax.Api.Models;

namespace Parallax.Api.Data;

public sealed class ParallaxDbContext(DbContextOptions<ParallaxDbContext> options) : DbContext(options)
{
    public DbSet<DatasetSource> DatasetSources => Set<DatasetSource>();
    public DbSet<SkyRegion> SkyRegions => Set<SkyRegion>();
    public DbSet<Observation> Observations => Set<Observation>();
    public DbSet<ObservationEpoch> ObservationEpochs => Set<ObservationEpoch>();
    public DbSet<ProcessingRun> ProcessingRuns => Set<ProcessingRun>();
    public DbSet<Candidate> Candidates => Set<Candidate>();
    public DbSet<CandidateMeasurement> CandidateMeasurements => Set<CandidateMeasurement>();
    public DbSet<CandidateSpectrum> CandidateSpectra => Set<CandidateSpectrum>();
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<Classification> Classifications => Set<Classification>();
    public DbSet<ClassificationConsensus> ClassificationConsensuses => Set<ClassificationConsensus>();
    public DbSet<Achievement> Achievements => Set<Achievement>();
    public DbSet<UserAchievement> UserAchievements => Set<UserAchievement>();
    public DbSet<AuditEntry> AuditEntries => Set<AuditEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DatasetSource>().HasIndex(x => new { x.DatasetType, x.SourceIdentifier }).IsUnique();
        modelBuilder.Entity<SkyRegion>().HasIndex(x => x.Name).IsUnique();
        modelBuilder.Entity<Observation>().HasIndex(x => x.ObservationIdentifier).IsUnique();
        modelBuilder.Entity<ObservationEpoch>().HasIndex(x => new { x.ObservationId, x.EpochCode }).IsUnique();
        modelBuilder.Entity<ProcessingRun>().HasIndex(x => x.StartedAtUtc);
        modelBuilder.Entity<Candidate>().HasIndex(x => new { x.ProcessingRunId, x.CandidateKey }).IsUnique();
        modelBuilder.Entity<UserProfile>().HasIndex(x => x.ExternalKey).IsUnique();
        modelBuilder.Entity<Classification>().HasIndex(x => new { x.CandidateId, x.UserProfileId }).IsUnique();
        modelBuilder.Entity<ClassificationConsensus>().HasIndex(x => new { x.CandidateId, x.ClassificationLabel }).IsUnique();
        modelBuilder.Entity<Achievement>().HasIndex(x => x.Key).IsUnique();
        modelBuilder.Entity<UserAchievement>().HasIndex(x => new { x.UserProfileId, x.AchievementId }).IsUnique();

        modelBuilder.Entity<DatasetSource>().Property(x => x.CreatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
        modelBuilder.Entity<Observation>().Property(x => x.CreatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
        modelBuilder.Entity<Candidate>().Property(x => x.CreatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
        modelBuilder.Entity<UserProfile>().Property(x => x.CreatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
        modelBuilder.Entity<AuditEntry>().Property(x => x.CreatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
        modelBuilder.Entity<DatasetSource>().HasMany(x => x.Observations).WithOne(x => x.DatasetSource).HasForeignKey(x => x.DatasetSourceId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<DatasetSource>().HasMany(x => x.ProcessingRuns).WithOne(x => x.DatasetSource).HasForeignKey(x => x.DatasetSourceId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<SkyRegion>().HasMany(x => x.Observations).WithOne(x => x.SkyRegion).HasForeignKey(x => x.SkyRegionId).OnDelete(DeleteBehavior.SetNull);
        modelBuilder.Entity<SkyRegion>().HasMany(x => x.Candidates).WithOne(x => x.SkyRegion).HasForeignKey(x => x.SkyRegionId).OnDelete(DeleteBehavior.SetNull);
        modelBuilder.Entity<Observation>().HasMany(x => x.Epochs).WithOne(x => x.Observation).HasForeignKey(x => x.ObservationId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<ProcessingRun>().HasMany(x => x.Candidates).WithOne(x => x.ProcessingRun).HasForeignKey(x => x.ProcessingRunId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Candidate>().HasMany(x => x.Measurements).WithOne(x => x.Candidate).HasForeignKey(x => x.CandidateId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Candidate>().HasMany(x => x.Spectra).WithOne(x => x.Candidate).HasForeignKey(x => x.CandidateId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Candidate>().HasMany(x => x.Classifications).WithOne(x => x.Candidate).HasForeignKey(x => x.CandidateId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<UserProfile>().HasMany(x => x.Classifications).WithOne(x => x.UserProfile).HasForeignKey(x => x.UserProfileId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Candidate>().HasMany(x => x.Consensuses).WithOne(x => x.Candidate).HasForeignKey(x => x.CandidateId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<UserProfile>().HasMany(x => x.Achievements).WithOne(x => x.UserProfile).HasForeignKey(x => x.UserProfileId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Achievement>().HasMany(x => x.UserAchievements).WithOne(x => x.Achievement).HasForeignKey(x => x.AchievementId).OnDelete(DeleteBehavior.Cascade);
    }
}
