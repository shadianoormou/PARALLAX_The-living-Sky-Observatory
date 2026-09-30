using System.Text.Json;
using System.Text.Json.Serialization;

namespace Parallax.Api.Contracts;

public sealed record DemoRunRequest(
    [property: JsonPropertyName("dataset")] string Dataset = "synthetic-demo",
    [property: JsonPropertyName("seed")] int Seed = 2026,
    [property: JsonPropertyName("background_sigma")] double BackgroundSigma = 1.0);

public sealed record ClassificationRequest(
    [property: JsonPropertyName("candidate_id")] Guid CandidateId,
    [property: JsonPropertyName("label")] string Label,
    [property: JsonPropertyName("notes")] string? Notes = null,
    [property: JsonPropertyName("confidence")] string? Confidence = null);

public sealed record ScienceProcessRequest(
    [property: JsonPropertyName("dataset")] string Dataset,
    [property: JsonPropertyName("seed")] int Seed,
    [property: JsonPropertyName("background_sigma")] double BackgroundSigma);

public sealed record SpherexArchiveRequest(
    [property: JsonPropertyName("ra_deg")] double RaDeg,
    [property: JsonPropertyName("dec_deg")] double DecDeg,
    [property: JsonPropertyName("radius_deg")] double RadiusDeg = 0.01,
    [property: JsonPropertyName("collection")] string Collection = "spherex_qr2",
    [property: JsonPropertyName("band")] string? Band = null,
    [property: JsonPropertyName("cutout_size_deg")] double CutoutSizeDeg = 0.1,
    [property: JsonPropertyName("max_results")] int MaxResults = 50);

public sealed class ScienceAnalysisResponse
{
    [JsonPropertyName("dataset_label")] public string DatasetLabel { get; set; } = string.Empty;
    [JsonPropertyName("epochs")] public Dictionary<string, JsonElement> Epochs { get; set; } = [];
    [JsonPropertyName("registration")] public JsonElement Registration { get; set; } = JsonSerializer.SerializeToElement(new { });
    [JsonPropertyName("photometric_normalization")] public JsonElement PhotometricNormalization { get; set; } = JsonSerializer.SerializeToElement(new { });
    [JsonPropertyName("difference")] public JsonElement Difference { get; set; } = JsonSerializer.SerializeToElement(new { });
    [JsonPropertyName("comparison")] public ScienceComparisonAssessment Comparison { get; set; } = new();
    [JsonPropertyName("spectral_comparison")] public List<ScienceSpectrum> SpectralComparison { get; set; } = [];
    [JsonPropertyName("candidates")] public List<ScienceCandidate> Candidates { get; set; } = [];
    [JsonPropertyName("screened_candidates")] public List<ScienceReviewItem> ScreenedCandidates { get; set; } = [];
}

public sealed class ScienceComparisonAssessment
{
    [JsonPropertyName("status")] public string Status { get; set; } = "COMPARISON NOT RELIABLE";
    [JsonPropertyName("reasons")] public List<string> Reasons { get; set; } = [];
    [JsonPropertyName("blocking_issues")] public List<string> BlockingIssues { get; set; } = [];
    [JsonPropertyName("warnings")] public List<string> Warnings { get; set; } = [];
    [JsonPropertyName("sky_overlap_fraction")] public double? SkyOverlapFraction { get; set; }
    [JsonPropertyName("registration_error")] public double? RegistrationError { get; set; }
}

public sealed class ScienceCandidate
{
    [JsonPropertyName("candidate_id")] public string CandidateId { get; set; } = string.Empty;
    [JsonPropertyName("classification")] public string Classification { get; set; } = string.Empty;
    [JsonPropertyName("measurement")] public Dictionary<string, JsonElement> Measurement { get; set; } = [];
    [JsonPropertyName("quality")] public Dictionary<string, JsonElement> Quality { get; set; } = [];
    [JsonPropertyName("interpretation")] public string Interpretation { get; set; } = string.Empty;
}

public sealed class ScienceReviewItem
{
    [JsonPropertyName("candidate_id")] public string CandidateId { get; set; } = string.Empty;
    [JsonPropertyName("classification")] public string Classification { get; set; } = string.Empty;
    [JsonPropertyName("status")] public string Status { get; set; } = "screened";
    [JsonPropertyName("measurement")] public Dictionary<string, JsonElement> Measurement { get; set; } = [];
    [JsonPropertyName("quality")] public Dictionary<string, JsonElement> Quality { get; set; } = [];
    [JsonPropertyName("interpretation")] public string Interpretation { get; set; } = string.Empty;
}

public sealed class ScienceSpectrum
{
    [JsonPropertyName("source_id")] public string SourceId { get; set; } = string.Empty;
    [JsonPropertyName("wavelength_um")] public List<double> WavelengthUm { get; set; } = [];
    [JsonPropertyName("flux_epoch_a")] public List<double> FluxEpochA { get; set; } = [];
    [JsonPropertyName("flux_epoch_b")] public List<double> FluxEpochB { get; set; } = [];
    [JsonPropertyName("delta_flux")] public List<double> DeltaFlux { get; set; } = [];
    [JsonPropertyName("interpretation")] public string Interpretation { get; set; } = string.Empty;
}

public sealed record CandidateListItem(Guid Id, string CandidateKey, string Classification, string Interpretation, string Status, DateTime CreatedAtUtc);

public sealed record CandidateDetail(
    Guid Id,
    string CandidateKey,
    string Classification,
    string Interpretation,
    string Status,
    Guid ProcessingRunId,
    string DatasetLabel,
    DateTime CreatedAtUtc);

public sealed record MeasurementResponse(Guid Id, string MetricName, double? Value, string? Unit, double? Uncertainty, JsonElement Metadata);

public sealed record SpectrumResponse(Guid Id, string SourceId, JsonElement WavelengthUm, JsonElement FluxEpochA, JsonElement FluxEpochB, JsonElement DeltaFlux, string Interpretation);

public sealed record ComparisonAssessmentResponse(Guid ProcessingRunId, string Status, IReadOnlyList<string> Reasons, IReadOnlyList<string> BlockingIssues, IReadOnlyList<string> Warnings, double? SkyOverlapFraction, double? RegistrationError, DateTime CreatedAtUtc);

public sealed record ProvenanceResponse(Guid CandidateId, string DatasetLabel, string DatasetType, string SourceIdentifier, string DatasetProvenance, JsonElement EpochA, JsonElement EpochB, string AlgorithmVersion, DateTime SourceCreatedAtUtc, DateTime? RetrievalTimestampUtc, DateTime ProcessingStartedAtUtc, DateTime? ProcessingCompletedAtUtc, ComparisonAssessmentResponse? Comparison);

public sealed record ConsensusResponse(Guid CandidateId, string ClassificationLabel, int VoteCount, int TotalVotes, double AgreementFraction, DateTime CalculatedAtUtc);

public sealed record PassportResponse(
    int ObjectsInspected,
    int CandidatesReviewed,
    int RegionsExplored,
    int ConsensusMatches,
    int ArtifactsIdentified,
    int LearningModulesCompleted,
    IReadOnlyList<string> LearningModules,
    IReadOnlyList<AchievementResponse> Achievements);

public sealed record AchievementResponse(string Key, string Name, string Description, DateTime EarnedAtUtc);
