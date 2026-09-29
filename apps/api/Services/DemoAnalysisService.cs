using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Parallax.Api.Contracts;
using Parallax.Api.Data;
using Parallax.Api.Models;

namespace Parallax.Api.Services;

public sealed class DemoAnalysisService(ParallaxDbContext db, IScienceServiceClient science, ILogger<DemoAnalysisService> logger)
{
    private const string AlgorithmVersion = "science-service:0.2.0";

    public async Task<ProcessingRun> RunAsync(DemoRunRequest request, CancellationToken cancellationToken)
    {
        if (!string.Equals(request.Dataset, "synthetic-demo", StringComparison.Ordinal))
        {
            throw new ArgumentException("Only the explicitly labeled synthetic-demo dataset is available.", nameof(request));
        }
        if (request.Seed < 0) throw new ArgumentException("Seed must be non-negative.", nameof(request));
        if (request.BackgroundSigma <= 0 || request.BackgroundSigma > 10) throw new ArgumentException("Background sigma must be greater than 0 and no greater than 10.", nameof(request));

        var started = DateTime.UtcNow;
        var scienceRequest = new ScienceProcessRequest(request.Dataset, request.Seed, request.BackgroundSigma);
        var analysis = await science.AnalyzeAsync(scienceRequest, cancellationToken);
        if (!string.Equals(analysis.DatasetLabel, "DEMONSTRATION DATASET", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Science response did not carry the required demonstration label.");
        }

        var epochA = GetObject(analysis.Epochs, "a");
        var epochB = GetObject(analysis.Epochs, "b");
        var sourceIdentifier = GetString(epochA, "dataset_id") ?? "synthetic-demo";
        var source = await db.DatasetSources.SingleOrDefaultAsync(x => x.DatasetType == request.Dataset && x.SourceIdentifier == sourceIdentifier, cancellationToken);
        if (source is null)
        {
            source = new DatasetSource
            {
                Id = Guid.NewGuid(), Name = "PARALLAX synthetic validation source", DatasetType = request.Dataset,
                Label = analysis.DatasetLabel, SourceIdentifier = sourceIdentifier,
                ProvenanceJson = epochA.GetRawText(), RetrievalTimestampUtc = DateTime.UtcNow, CreatedAtUtc = DateTime.UtcNow,
            };
            db.DatasetSources.Add(source);
        }

        var region = await db.SkyRegions.SingleOrDefaultAsync(x => x.Name == "Synthetic tangent-plane demo region", cancellationToken);
        if (region is null)
        {
            var shape = GetIntArray(epochA, "shape");
            region = new SkyRegion { Id = Guid.NewGuid(), Name = "Synthetic tangent-plane demo region", WidthPixels = shape.ElementAtOrDefault(1), HeightPixels = shape.ElementAtOrDefault(0) };
            db.SkyRegions.Add(region);
        }

        var observations = await EnsureObservationsAsync(source, region, epochA, epochB, cancellationToken);
        var run = new ProcessingRun
        {
            Id = Guid.NewGuid(), DatasetSourceId = source.Id, AlgorithmVersion = AlgorithmVersion,
            Status = "completed", StartedAtUtc = started, CompletedAtUtc = DateTime.UtcNow,
            ParametersJson = JsonSerializer.Serialize(request), ResultJson = JsonSerializer.Serialize(analysis),
        };
        db.ProcessingRuns.Add(run);

        foreach (var scienceCandidate in analysis.Candidates)
        {
            var candidate = new Candidate
            {
                Id = Guid.NewGuid(), ProcessingRunId = run.Id, SkyRegionId = region.Id,
                CandidateKey = DisplayCandidateKey(scienceCandidate.CandidateId, scienceCandidate.Classification), Classification = scienceCandidate.Classification,
                Interpretation = scienceCandidate.Interpretation, Status = "candidate", CreatedAtUtc = DateTime.UtcNow,
            };
            db.Candidates.Add(candidate);
            AddMeasurements(candidate, scienceCandidate.Measurement, "measurement");
            AddMeasurements(candidate, scienceCandidate.Quality, "quality");
            AddSpectrum(candidate, scienceCandidate.Classification, analysis.SpectralComparison);
        }
        foreach (var screenedItem in analysis.ScreenedCandidates)
        {
            var candidate = new Candidate
            {
                Id = Guid.NewGuid(), ProcessingRunId = run.Id, SkyRegionId = region.Id,
                CandidateKey = screenedItem.CandidateId, Classification = screenedItem.Classification,
                Interpretation = screenedItem.Interpretation, Status = screenedItem.Status, CreatedAtUtc = DateTime.UtcNow,
            };
            db.Candidates.Add(candidate);
            AddMeasurements(candidate, screenedItem.Measurement, "measurement");
            AddMeasurements(candidate, screenedItem.Quality, "quality");
        }
        db.AuditEntries.Add(new AuditEntry { Id = Guid.NewGuid(), Action = "demo-analysis-completed", ActorKey = "system", EntityType = nameof(ProcessingRun), EntityId = run.Id, MetadataJson = JsonSerializer.Serialize(new { request.Dataset, request.Seed, candidates = analysis.Candidates.Count }), CreatedAtUtc = DateTime.UtcNow });
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Persisted demo processing run {RunId} with {CandidateCount} candidates", run.Id, analysis.Candidates.Count);
        return run;
    }

    private async Task<List<Observation>> EnsureObservationsAsync(DatasetSource source, SkyRegion region, JsonElement epochA, JsonElement epochB, CancellationToken cancellationToken)
    {
        var result = new List<Observation>();
        foreach (var epoch in new[] { epochA, epochB })
        {
            var identifier = GetString(epoch, "observation_id") ?? $"synthetic-epoch-{result.Count + 1}";
            var observation = await db.Observations.Include(x => x.Epochs).SingleOrDefaultAsync(x => x.ObservationIdentifier == identifier, cancellationToken);
            if (observation is null)
            {
                observation = new Observation
                {
                    Id = Guid.NewGuid(), DatasetSourceId = source.Id, SkyRegionId = region.Id,
                    ObservationIdentifier = identifier, Label = GetString(epoch, "dataset_label") ?? "DEMONSTRATION DATASET",
                    CoordinateFrame = GetString(epoch, "coordinate_frame") ?? "unknown", PixelScaleArcsec = GetDouble(epoch, "pixel_scale_arcsec"),
                    ShapeJson = GetRaw(epoch, "shape"), ProvenanceJson = epoch.GetRawText(), CreatedAtUtc = DateTime.UtcNow,
                };
                observation.Epochs.Add(new ObservationEpoch { Id = Guid.NewGuid(), EpochCode = GetString(epoch, "epoch") ?? "?", MetadataJson = epoch.GetRawText() });
                db.Observations.Add(observation);
            }
            result.Add(observation);
        }
        return result;
    }

    private static void AddMeasurements(Candidate candidate, Dictionary<string, JsonElement> values, string category)
    {
        foreach (var (key, value) in values)
        {
            var numeric = value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number) ? number : (double?)null;
            candidate.Measurements.Add(new CandidateMeasurement { Id = Guid.NewGuid(), Candidate = candidate, MetricName = $"{category}.{key}", Value = numeric, Unit = InferUnit(key), MetadataJson = value.GetRawText() });
        }
    }

    private static void AddSpectrum(Candidate candidate, string classification, IEnumerable<ScienceSpectrum> spectra)
    {
        var sourceId = classification == "apparent_motion" ? "moving-source" : classification == "brightness_change" ? "variable-source" : null;
        var spectrum = spectra.FirstOrDefault(x => x.SourceId == sourceId);
        if (spectrum is null) return;
        candidate.Spectra.Add(new CandidateSpectrum { Id = Guid.NewGuid(), Candidate = candidate, SourceId = spectrum.SourceId, WavelengthUmJson = JsonSerializer.Serialize(spectrum.WavelengthUm), FluxEpochAJson = JsonSerializer.Serialize(spectrum.FluxEpochA), FluxEpochBJson = JsonSerializer.Serialize(spectrum.FluxEpochB), DeltaFluxJson = JsonSerializer.Serialize(spectrum.DeltaFlux), Interpretation = spectrum.Interpretation });
    }

    private static string? InferUnit(string key) => key.Contains("arcsec", StringComparison.OrdinalIgnoreCase) ? "arcsec" : key.Contains("pixels", StringComparison.OrdinalIgnoreCase) ? "pixels" : null;
    private static string DisplayCandidateKey(string scienceCandidateId, string classification) => classification == "apparent_motion" ? "PX-DEMO-017" : scienceCandidateId;
    private static JsonElement GetObject(Dictionary<string, JsonElement> values, string key) => values.TryGetValue(key, out var value) ? value : throw new InvalidOperationException($"Science response did not contain epoch {key}.");
    private static string? GetString(JsonElement value, string key) => value.TryGetProperty(key, out var property) && property.ValueKind == JsonValueKind.String ? property.GetString() : null;
    private static double GetDouble(JsonElement value, string key) => value.TryGetProperty(key, out var property) && property.TryGetDouble(out var number) ? number : 0;
    private static string GetRaw(JsonElement value, string key) => value.TryGetProperty(key, out var property) ? property.GetRawText() : "null";
    private static int[] GetIntArray(JsonElement value, string key) => value.TryGetProperty(key, out var property) && property.ValueKind == JsonValueKind.Array ? property.EnumerateArray().Select(x => x.GetInt32()).ToArray() : [];
}
