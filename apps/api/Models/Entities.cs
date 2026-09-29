using System.ComponentModel.DataAnnotations;

namespace Parallax.Api.Models;

public sealed class DatasetSource
{
    public Guid Id { get; set; }
    [MaxLength(160)] public string Name { get; set; } = string.Empty;
    [MaxLength(80)] public string DatasetType { get; set; } = string.Empty;
    [MaxLength(120)] public string Label { get; set; } = string.Empty;
    [MaxLength(200)] public string SourceIdentifier { get; set; } = string.Empty;
    public DateTime? RetrievalTimestampUtc { get; set; }
    public string ProvenanceJson { get; set; } = "{}";
    public DateTime CreatedAtUtc { get; set; }
    public ICollection<Observation> Observations { get; set; } = [];
    public ICollection<ProcessingRun> ProcessingRuns { get; set; } = [];
}

public sealed class SkyRegion
{
    public Guid Id { get; set; }
    [MaxLength(160)] public string Name { get; set; } = string.Empty;
    public double CenterRightAscensionDeg { get; set; }
    public double CenterDeclinationDeg { get; set; }
    public int WidthPixels { get; set; }
    public int HeightPixels { get; set; }
    public ICollection<Observation> Observations { get; set; } = [];
    public ICollection<Candidate> Candidates { get; set; } = [];
}

public sealed class Observation
{
    public Guid Id { get; set; }
    public Guid DatasetSourceId { get; set; }
    public Guid? SkyRegionId { get; set; }
    [MaxLength(200)] public string ObservationIdentifier { get; set; } = string.Empty;
    [MaxLength(160)] public string Label { get; set; } = string.Empty;
    [MaxLength(160)] public string CoordinateFrame { get; set; } = string.Empty;
    public double PixelScaleArcsec { get; set; }
    public string ShapeJson { get; set; } = "[]";
    public string ProvenanceJson { get; set; } = "{}";
    public DateTime CreatedAtUtc { get; set; }
    public DatasetSource DatasetSource { get; set; } = null!;
    public SkyRegion? SkyRegion { get; set; }
    public ICollection<ObservationEpoch> Epochs { get; set; } = [];
}

public sealed class ObservationEpoch
{
    public Guid Id { get; set; }
    public Guid ObservationId { get; set; }
    [MaxLength(8)] public string EpochCode { get; set; } = string.Empty;
    public DateTime? CapturedAtUtc { get; set; }
    [MaxLength(260)] public string? ImageArtifactPath { get; set; }
    public string MetadataJson { get; set; } = "{}";
    public Observation Observation { get; set; } = null!;
}

public sealed class ProcessingRun
{
    public Guid Id { get; set; }
    public Guid DatasetSourceId { get; set; }
    [MaxLength(80)] public string AlgorithmVersion { get; set; } = string.Empty;
    [MaxLength(40)] public string Status { get; set; } = string.Empty;
    public DateTime StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public string ParametersJson { get; set; } = "{}";
    public string ResultJson { get; set; } = "{}";
    public string? ErrorMessage { get; set; }
    public DatasetSource DatasetSource { get; set; } = null!;
    public ICollection<Candidate> Candidates { get; set; } = [];
}

public sealed class Candidate
{
    public Guid Id { get; set; }
    public Guid ProcessingRunId { get; set; }
    public Guid? SkyRegionId { get; set; }
    [MaxLength(120)] public string CandidateKey { get; set; } = string.Empty;
    [MaxLength(80)] public string Classification { get; set; } = string.Empty;
    [MaxLength(500)] public string Interpretation { get; set; } = string.Empty;
    [MaxLength(40)] public string Status { get; set; } = "candidate";
    public DateTime CreatedAtUtc { get; set; }
    public ProcessingRun ProcessingRun { get; set; } = null!;
    public SkyRegion? SkyRegion { get; set; }
    public ICollection<CandidateMeasurement> Measurements { get; set; } = [];
    public ICollection<CandidateSpectrum> Spectra { get; set; } = [];
    public ICollection<Classification> Classifications { get; set; } = [];
    public ICollection<ClassificationConsensus> Consensuses { get; set; } = [];
}

public sealed class CandidateMeasurement
{
    public Guid Id { get; set; }
    public Guid CandidateId { get; set; }
    [MaxLength(120)] public string MetricName { get; set; } = string.Empty;
    public double? Value { get; set; }
    [MaxLength(40)] public string? Unit { get; set; }
    public double? Uncertainty { get; set; }
    public string MetadataJson { get; set; } = "{}";
    public Candidate Candidate { get; set; } = null!;
}

public sealed class CandidateSpectrum
{
    public Guid Id { get; set; }
    public Guid CandidateId { get; set; }
    [MaxLength(120)] public string SourceId { get; set; } = string.Empty;
    public string WavelengthUmJson { get; set; } = "[]";
    public string FluxEpochAJson { get; set; } = "[]";
    public string FluxEpochBJson { get; set; } = "[]";
    public string DeltaFluxJson { get; set; } = "[]";
    public string Interpretation { get; set; } = string.Empty;
    public Candidate Candidate { get; set; } = null!;
}

public sealed class UserProfile
{
    public Guid Id { get; set; }
    [MaxLength(120)] public string ExternalKey { get; set; } = string.Empty;
    [MaxLength(160)] public string DisplayName { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public ICollection<Classification> Classifications { get; set; } = [];
    public ICollection<UserAchievement> Achievements { get; set; } = [];
}

public sealed class Classification
{
    public Guid Id { get; set; }
    public Guid CandidateId { get; set; }
    public Guid UserProfileId { get; set; }
    [MaxLength(80)] public string Label { get; set; } = string.Empty;
    [MaxLength(20)] public string? Confidence { get; set; }
    [MaxLength(1000)] public string? Notes { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public Candidate Candidate { get; set; } = null!;
    public UserProfile UserProfile { get; set; } = null!;
}

public sealed class ClassificationConsensus
{
    public Guid Id { get; set; }
    public Guid CandidateId { get; set; }
    [MaxLength(80)] public string ClassificationLabel { get; set; } = string.Empty;
    public int VoteCount { get; set; }
    public int TotalVotes { get; set; }
    public double AgreementFraction { get; set; }
    public DateTime CalculatedAtUtc { get; set; }
    public Candidate Candidate { get; set; } = null!;
}

public sealed class Achievement
{
    public Guid Id { get; set; }
    [MaxLength(80)] public string Key { get; set; } = string.Empty;
    [MaxLength(160)] public string Name { get; set; } = string.Empty;
    [MaxLength(500)] public string Description { get; set; } = string.Empty;
    public ICollection<UserAchievement> UserAchievements { get; set; } = [];
}

public sealed class UserAchievement
{
    public Guid Id { get; set; }
    public Guid UserProfileId { get; set; }
    public Guid AchievementId { get; set; }
    public DateTime EarnedAtUtc { get; set; }
    public UserProfile UserProfile { get; set; } = null!;
    public Achievement Achievement { get; set; } = null!;
}

public sealed class AuditEntry
{
    public Guid Id { get; set; }
    [MaxLength(120)] public string Action { get; set; } = string.Empty;
    [MaxLength(120)] public string ActorKey { get; set; } = string.Empty;
    [MaxLength(80)] public string EntityType { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
    public string MetadataJson { get; set; } = "{}";
    public DateTime CreatedAtUtc { get; set; }
}
