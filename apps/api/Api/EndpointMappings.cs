using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Parallax.Api.Contracts;
using Parallax.Api.Data;
using Parallax.Api.Models;
using Parallax.Api.Services;

namespace Parallax.Api;

public static class EndpointMappings
{
    private static readonly SemaphoreSlim DemoAnalysisGate = new(1, 1);

    public static void MapParallaxEndpoints(this WebApplication app)
    {
        app.MapGet("/api/regions", async (ParallaxDbContext db, CancellationToken cancellationToken) =>
        {
            var regions = await db.SkyRegions.AsNoTracking().Select(region => new
            {
                region.Id, region.Name, region.CenterRightAscensionDeg, region.CenterDeclinationDeg,
                region.WidthPixels, region.HeightPixels,
                ObservationCount = region.Observations.Count,
                CandidateCount = region.Candidates.Count,
            }).ToListAsync(cancellationToken);
            return Results.Ok(regions);
        });

        app.MapGet("/api/regions/{id:guid}", async (Guid id, ParallaxDbContext db, CancellationToken cancellationToken) =>
        {
            var region = await db.SkyRegions.AsNoTracking().Where(x => x.Id == id).Select(x => new
            {
                x.Id, x.Name, x.CenterRightAscensionDeg, x.CenterDeclinationDeg, x.WidthPixels, x.HeightPixels,
                Observations = x.Observations.Select(observation => new { observation.Id, observation.ObservationIdentifier, observation.Label, EpochCount = observation.Epochs.Count }),
                Candidates = x.Candidates.Select(candidate => new CandidateListItem(candidate.Id, candidate.CandidateKey, candidate.Classification, candidate.Interpretation, candidate.Status, candidate.CreatedAtUtc)),
            }).SingleOrDefaultAsync(cancellationToken);
            return region is null ? Results.NotFound() : Results.Ok(region);
        });

        app.MapGet("/api/candidates", async (string? classification, ParallaxDbContext db, CancellationToken cancellationToken) =>
        {
            var query = db.Candidates.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(classification)) query = query.Where(x => x.Classification == classification);
            var candidates = await query.OrderByDescending(x => x.CreatedAtUtc).Select(candidate => new CandidateListItem(candidate.Id, candidate.CandidateKey, candidate.Classification, candidate.Interpretation, candidate.Status, candidate.CreatedAtUtc)).ToListAsync(cancellationToken);
            return Results.Ok(candidates);
        });

        app.MapGet("/api/candidates/{id:guid}", async (Guid id, ParallaxDbContext db, CancellationToken cancellationToken) =>
        {
            var candidate = await db.Candidates.AsNoTracking().Include(x => x.ProcessingRun).ThenInclude(x => x.DatasetSource).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
            return candidate is null
                ? Results.NotFound()
                : Results.Ok(new CandidateDetail(candidate.Id, candidate.CandidateKey, candidate.Classification, candidate.Interpretation, candidate.Status, candidate.ProcessingRunId, candidate.ProcessingRun.DatasetSource.Label, candidate.CreatedAtUtc));
        });

        app.MapGet("/api/candidates/{id:guid}/measurements", async (Guid id, ParallaxDbContext db, CancellationToken cancellationToken) =>
        {
            var measurements = await db.CandidateMeasurements.AsNoTracking().Where(x => x.CandidateId == id).OrderBy(x => x.MetricName).ToListAsync(cancellationToken);
            return Results.Ok(measurements.Select(x => new MeasurementResponse(x.Id, x.MetricName, x.Value, x.Unit, x.Uncertainty, ParseJson(x.MetadataJson))));
        });

        app.MapGet("/api/candidates/{id:guid}/spectrum", async (Guid id, ParallaxDbContext db, CancellationToken cancellationToken) =>
        {
            var spectra = await db.CandidateSpectra.AsNoTracking().Where(x => x.CandidateId == id).ToListAsync(cancellationToken);
            return Results.Ok(spectra.Select(x => new SpectrumResponse(x.Id, x.SourceId, ParseJson(x.WavelengthUmJson), ParseJson(x.FluxEpochAJson), ParseJson(x.FluxEpochBJson), ParseJson(x.DeltaFluxJson), x.Interpretation)));
        });

        app.MapGet("/api/candidates/{id:guid}/provenance", async (Guid id, ParallaxDbContext db, CancellationToken cancellationToken) =>
        {
            var candidate = await db.Candidates.AsNoTracking()
                .Include(x => x.ProcessingRun).ThenInclude(x => x.DatasetSource)
                .Include(x => x.ProcessingRun).ThenInclude(x => x.ComparisonAssessment)
                .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
            if (candidate is null) return Results.NotFound();
            var source = candidate.ProcessingRun.DatasetSource;
            var result = ParseJson(candidate.ProcessingRun.ResultJson);
            var epochs = result.ValueKind == JsonValueKind.Object && result.TryGetProperty("epochs", out var value) ? value : ParseJson("{}");
            var epochA = epochs.ValueKind == JsonValueKind.Object && epochs.TryGetProperty("a", out var a) ? a : ParseJson("{}");
            var epochB = epochs.ValueKind == JsonValueKind.Object && epochs.TryGetProperty("b", out var b) ? b : ParseJson("{}");
            var comparison = candidate.ProcessingRun.ComparisonAssessment is { } assessment
                ? ParseComparison(assessment.AssessmentJson, candidate.ProcessingRunId, assessment.CreatedAtUtc)
                : null;
            return Results.Ok(new ProvenanceResponse(candidate.Id, source.Label, source.DatasetType, source.SourceIdentifier, source.ProvenanceJson, epochA, epochB, candidate.ProcessingRun.AlgorithmVersion, source.CreatedAtUtc, source.RetrievalTimestampUtc, candidate.ProcessingRun.StartedAtUtc, candidate.ProcessingRun.CompletedAtUtc, comparison));
        });

        app.MapGet("/api/comparisons/{processingRunId:guid}", async (Guid processingRunId, ParallaxDbContext db, CancellationToken cancellationToken) =>
        {
            var assessment = await db.ComparisonAssessments.AsNoTracking().SingleOrDefaultAsync(x => x.ProcessingRunId == processingRunId, cancellationToken);
            if (assessment is null) return Results.NotFound();
            return Results.Ok(ParseComparison(assessment.AssessmentJson, processingRunId, assessment.CreatedAtUtc));
        });

        app.MapGet("/api/candidates/{id:guid}/consensus", async (Guid id, HttpRequest request, ParallaxDbContext db, CancellationToken cancellationToken) =>
        {
            var actor = DemoUserKey(request);
            var hasVoted = await db.Classifications.AnyAsync(x => x.CandidateId == id && x.UserProfile.ExternalKey == actor, cancellationToken);
            if (!hasVoted) return Results.Problem("Submit a classification before viewing community consensus.", statusCode: StatusCodes.Status403Forbidden, title: "Classification required");
            var consensus = await db.ClassificationConsensuses.AsNoTracking().Where(x => x.CandidateId == id).OrderByDescending(x => x.VoteCount).Select(x => new ConsensusResponse(x.CandidateId, x.ClassificationLabel, x.VoteCount, x.TotalVotes, x.AgreementFraction, x.CalculatedAtUtc)).ToListAsync(cancellationToken);
            return Results.Ok(consensus);
        });

        app.MapGet("/api/passport", async (HttpRequest request, PassportService passport, CancellationToken cancellationToken) =>
            Results.Ok(await passport.GetAsync(DemoUserKey(request), cancellationToken)));

        app.MapGet("/api/community/metrics", async (ParallaxDbContext db, CancellationToken cancellationToken) =>
        {
            var classifications = await db.Classifications.AsNoTracking().ToListAsync(cancellationToken);
            var consensus = await db.ClassificationConsensuses.AsNoTracking().ToListAsync(cancellationToken);
            var winningAgreement = consensus
                .GroupBy(item => item.CandidateId)
                .Select(group => group.Max(item => item.AgreementFraction))
                .ToArray();
            var labels = classifications
                .GroupBy(item => item.Label, StringComparer.OrdinalIgnoreCase)
                .OrderByDescending(group => group.Count())
                .ThenBy(group => group.Key)
                .Select(group => new CommunityLabelCount(group.Key, group.Count()))
                .ToArray();
            return Results.Ok(new CommunityMetricsResponse(
                classifications.Count,
                classifications.Select(item => item.UserProfileId).Distinct().Count(),
                classifications.Select(item => item.CandidateId).Distinct().Count(),
                winningAgreement.Length,
                winningAgreement.Length == 0 ? 0 : winningAgreement.Average(),
                labels,
                classifications.Count == 0 ? null : classifications.Min(item => item.CreatedAtUtc),
                classifications.Count == 0 ? null : classifications.Max(item => item.CreatedAtUtc)));
        });

        app.MapGet("/api/validation", async (IScienceServiceClient science, CancellationToken cancellationToken) =>
            Results.Ok(await science.RunValidationAsync(cancellationToken)));

        app.MapPost("/api/archive/spherex/search", async (SpherexArchiveRequest body, IScienceServiceClient science, CancellationToken cancellationToken) =>
            Results.Ok(await science.SearchSpherexAsync(body, cancellationToken)));

        app.MapPost("/api/archive/spherex/analyze", async (SpherexArchiveRequest body, IScienceServiceClient science, CancellationToken cancellationToken) =>
            Results.Ok(await science.AnalyzeSpherexAsync(body, cancellationToken)));

        app.MapPost("/api/archive/spherex/validate", async (SpherexValidationRequest body, IScienceServiceClient science, CancellationToken cancellationToken) =>
            Results.Ok(await science.ValidateSpherexAsync(body, cancellationToken)));

        app.MapPost("/api/passport/modules/{moduleKey}", async (string moduleKey, HttpRequest request, PassportService passport, CancellationToken cancellationToken) =>
        {
            var result = await passport.CompleteModuleAsync(DemoUserKey(request), moduleKey, cancellationToken);
            return result is null ? Results.ValidationProblem(new Dictionary<string, string[]> { ["moduleKey"] = ["Unknown learning module."] }) : Results.Ok(result);
        });

        app.MapPost("/api/classifications", async (ClassificationRequest body, HttpRequest request, ParallaxDbContext db, ConsensusService consensus, CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(body.Label)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["label"] = ["A classification label is required."] });
            var candidateId = body.CandidateId;
            if (candidateId == Guid.Empty) return Results.ValidationProblem(new Dictionary<string, string[]> { ["candidate_id"] = ["A candidate_id is required."] });
            var candidate = await db.Candidates.SingleOrDefaultAsync(x => x.Id == candidateId, cancellationToken);
            if (candidate is null) return Results.NotFound();
            var actor = DemoUserKey(request);
            var user = await GetOrCreateUserAsync(db, actor, cancellationToken);
            var classification = await db.Classifications.SingleOrDefaultAsync(x => x.CandidateId == candidateId && x.UserProfileId == user.Id, cancellationToken);
            if (classification is null)
            {
                classification = new Classification { Id = Guid.NewGuid(), CandidateId = candidateId, UserProfileId = user.Id, CreatedAtUtc = DateTime.UtcNow };
                db.Classifications.Add(classification);
            }
            classification.Label = body.Label.Trim();
            var confidence = body.Confidence?.Trim().ToUpperInvariant();
            if (confidence is not null && confidence is not ("LOW" or "MEDIUM" or "HIGH")) return Results.ValidationProblem(new Dictionary<string, string[]> { ["confidence"] = ["Confidence must be LOW, MEDIUM, or HIGH."] });
            classification.Confidence = confidence;
            classification.Notes = body.Notes;
            db.AuditEntries.Add(new AuditEntry { Id = Guid.NewGuid(), Action = "classification-submitted", ActorKey = actor, EntityType = nameof(Candidate), EntityId = candidateId, MetadataJson = JsonSerializer.Serialize(new { classification.Label, classification.Confidence }), CreatedAtUtc = DateTime.UtcNow });
            await db.SaveChangesAsync(cancellationToken);
            await consensus.RecalculateAsync(candidateId, cancellationToken);
            return Results.Ok(new { classification.Id, candidateId, classification.Label, classification.Confidence, classification.CreatedAtUtc });
        });

        app.MapGet("/api/processing-runs/{id:guid}", async (Guid id, ParallaxDbContext db, CancellationToken cancellationToken) =>
        {
            var run = await db.ProcessingRuns.AsNoTracking().Include(x => x.DatasetSource).Include(x => x.Candidates).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
            return run is null ? Results.NotFound() : Results.Ok(new { run.Id, run.Status, run.AlgorithmVersion, run.StartedAtUtc, run.CompletedAtUtc, DatasetLabel = run.DatasetSource.Label, run.DatasetSource.SourceIdentifier, CandidateCount = run.Candidates.Count, Parameters = ParseJson(run.ParametersJson) });
        });

        app.MapPost("/api/demo/run-analysis", async (DemoRunRequest body, DemoAnalysisService demo, CancellationToken cancellationToken) =>
        {
            if (!await DemoAnalysisGate.WaitAsync(0, cancellationToken))
            {
                return Results.Problem("A demonstration analysis is already running. Try again shortly.", statusCode: StatusCodes.Status429TooManyRequests, title: "Analysis busy");
            }

            try
            {
                var run = await demo.RunAsync(body, cancellationToken);
                return Results.Ok(new { run.Id, run.Status, run.AlgorithmVersion, run.StartedAtUtc, run.CompletedAtUtc, CandidateCount = run.Candidates.Count });
            }
            finally
            {
                DemoAnalysisGate.Release();
            }
        });
    }

    private static string DemoUserKey(HttpRequest request) => request.Headers.TryGetValue("X-Demo-User", out var value) && !string.IsNullOrWhiteSpace(value) ? value.ToString() : "demo-user";

    private static async Task<UserProfile> GetOrCreateUserAsync(ParallaxDbContext db, string key, CancellationToken cancellationToken)
    {
        var user = await db.UserProfiles.SingleOrDefaultAsync(x => x.ExternalKey == key, cancellationToken);
        if (user is not null) return user;
        user = new UserProfile { Id = Guid.NewGuid(), ExternalKey = key, DisplayName = key, CreatedAtUtc = DateTime.UtcNow };
        db.UserProfiles.Add(user);
        return user;
    }

    private static JsonElement ParseJson(string value)
    {
        using var document = JsonDocument.Parse(string.IsNullOrWhiteSpace(value) ? "{}" : value);
        return document.RootElement.Clone();
    }

    private static ComparisonAssessmentResponse ParseComparison(string value, Guid processingRunId, DateTime createdAtUtc)
    {
        var assessment = JsonSerializer.Deserialize<ScienceComparisonAssessment>(value) ?? new ScienceComparisonAssessment();
        return new ComparisonAssessmentResponse(processingRunId, assessment.Status, assessment.Reasons, assessment.BlockingIssues, assessment.Warnings, assessment.SkyOverlapFraction, assessment.RegistrationError, createdAtUtc);
    }
}
