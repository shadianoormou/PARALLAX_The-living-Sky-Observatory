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

        app.MapGet("/api/community/consensus-report", async (ParallaxDbContext db, CancellationToken cancellationToken) =>
        {
            var candidates = await db.Candidates.AsNoTracking()
                .AsSplitQuery()
                .Include(item => item.Classifications)
                .Include(item => item.Consensuses)
                .Where(item => item.Classifications.Count > 0)
                .OrderByDescending(item => item.CreatedAtUtc)
                .ToListAsync(cancellationToken);
            var items = candidates.Select(candidate =>
            {
                var labels = candidate.Classifications
                    .GroupBy(item => item.Label, StringComparer.OrdinalIgnoreCase)
                    .OrderByDescending(group => group.Count())
                    .ThenBy(group => group.Key)
                    .Select(group => new CommunityLabelCount(group.Key, group.Count()))
                    .ToArray();
                var leading = candidate.Consensuses.OrderByDescending(item => item.VoteCount).ThenBy(item => item.ClassificationLabel).FirstOrDefault();
                return new ConsensusReportItem(candidate.Id, candidate.CandidateKey, candidate.Classification, candidate.Status, candidate.Classifications.Count, leading?.ClassificationLabel, leading?.VoteCount ?? 0, leading?.AgreementFraction ?? 0, labels, leading?.CalculatedAtUtc);
            }).ToArray();
            var agreements = items.Where(item => item.LeadingLabel is not null).Select(item => item.AgreementFraction).ToArray();
            return Results.Ok(new ConsensusReportResponse(items.Length, items.Sum(item => item.TotalVotes), agreements.Length, agreements.Length == 0 ? 0 : agreements.Average(), items));
        });

        app.MapPost("/api/public-evidence-bundles", async (PublicEvidenceBundleRequest body, HttpRequest request, ParallaxDbContext db, CancellationToken cancellationToken) =>
        {
            var title = body.Title.Trim();
            if (title.Length is < 3 or > 160 || body.Payload.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["bundle"] = ["A title and JSON payload are required."] });
            if (body.Payload.GetRawText().Length > 2_000_000)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["payload"] = ["Evidence bundles must be smaller than 2 MB."] });

            var createdAt = DateTime.UtcNow;
            var expiresAt = body.ExpiresAtUtc is { } requested && requested > createdAt && requested <= createdAt.AddDays(90)
                ? requested.ToUniversalTime()
                : createdAt.AddDays(30);
            var bundleId = Guid.NewGuid();
            db.AuditEntries.Add(new AuditEntry
            {
                Id = Guid.NewGuid(),
                Action = "public-evidence-bundle",
                ActorKey = DemoUserKey(request),
                EntityType = "PublicEvidenceBundle",
                EntityId = bundleId,
                MetadataJson = JsonSerializer.Serialize(new { bundleId, title, payload = body.Payload, createdAtUtc = createdAt, expiresAtUtc = expiresAt }),
                CreatedAtUtc = createdAt,
            });
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(new PublicEvidenceBundleCreatedResponse(bundleId, $"/evidence/{bundleId}", createdAt, expiresAt));
        });

        app.MapGet("/api/public-evidence-bundles/{id:guid}", async (Guid id, ParallaxDbContext db, CancellationToken cancellationToken) =>
        {
            var entry = await db.AuditEntries.AsNoTracking().SingleOrDefaultAsync(item => item.Action == "public-evidence-bundle" && item.EntityId == id, cancellationToken);
            if (entry is null) return Results.NotFound();
            var stored = ParseJson(entry.MetadataJson);
            if (stored.ValueKind != JsonValueKind.Object || !stored.TryGetProperty("expiresAtUtc", out var expiresElement) || !expiresElement.TryGetDateTime(out var expiresAt))
                return Results.Problem("The evidence bundle is malformed.", statusCode: StatusCodes.Status500InternalServerError);
            if (expiresAt <= DateTime.UtcNow) return Results.StatusCode(StatusCodes.Status410Gone);
            var title = stored.TryGetProperty("title", out var titleElement) ? titleElement.GetString() ?? "Public evidence bundle" : "Public evidence bundle";
            var payload = stored.TryGetProperty("payload", out var payloadElement) ? payloadElement : ParseJson("{}");
            var createdAt = stored.TryGetProperty("createdAtUtc", out var createdElement) && createdElement.TryGetDateTime(out var parsedCreated) ? parsedCreated : entry.CreatedAtUtc;
            return Results.Ok(new PublicEvidenceBundleResponse(id, title, payload, createdAt, expiresAt));
        });

        app.MapGet("/api/research-feedback/metrics", async (ParallaxDbContext db, CancellationToken cancellationToken) =>
        {
            var entries = await db.AuditEntries.AsNoTracking().Where(item => item.Action == "research-feedback").ToListAsync(cancellationToken);
            var metadata = entries.Select(item => new { item.ActorKey, item.CreatedAtUtc, Data = ParseJson(item.MetadataJson) }).Where(item => item.Data.ValueKind == JsonValueKind.Object && item.Data.TryGetProperty("signal", out _)).ToArray();
            var signals = metadata
                .GroupBy(item => item.Data.GetProperty("signal").GetString() ?? "unknown", StringComparer.OrdinalIgnoreCase)
                .OrderByDescending(group => group.Count())
                .ThenBy(group => group.Key)
                .Select(group => new CommunityLabelCount(group.Key, group.Count()))
                .ToArray();
            var roles = metadata
                .Select(item => item.Data.TryGetProperty("role", out var role) ? role.GetString() : null)
                .Where(role => !string.IsNullOrWhiteSpace(role))
                .GroupBy(role => role!, StringComparer.OrdinalIgnoreCase)
                .OrderByDescending(group => group.Count())
                .ThenBy(group => group.Key)
                .Select(group => new CommunityLabelCount(group.Key, group.Count()))
                .ToArray();
            var languages = metadata
                .Select(item => item.Data.TryGetProperty("language", out var language) ? language.GetString() : null)
                .Where(language => !string.IsNullOrWhiteSpace(language))
                .GroupBy(language => language!, StringComparer.OrdinalIgnoreCase)
                .OrderByDescending(group => group.Count())
                .ThenBy(group => group.Key)
                .Select(group => new CommunityLabelCount(group.Key, group.Count()))
                .ToArray();
            var regions = metadata
                .Select(item => item.Data.TryGetProperty("region", out var region) ? region.GetString() : null)
                .Where(region => !string.IsNullOrWhiteSpace(region))
                .GroupBy(region => region!, StringComparer.OrdinalIgnoreCase)
                .OrderByDescending(group => group.Count())
                .ThenBy(group => group.Key)
                .Select(group => new CommunityLabelCount(group.Key, group.Count()))
                .ToArray();
            var uniqueParticipants = metadata.Select(item => item.ActorKey).Distinct(StringComparer.OrdinalIgnoreCase).Count();
            var status = uniqueParticipants >= 5 ? "minimum-reached" : uniqueParticipants > 0 ? "in-progress" : "not-started";
            return Results.Ok(new ResearchFeedbackMetricsResponse(metadata.Length, signals, uniqueParticipants, roles, languages, regions, 5, 10, status, metadata.Length == 0 ? null : metadata.Min(item => item.CreatedAtUtc), metadata.Length == 0 ? null : metadata.Max(item => item.CreatedAtUtc)));
        });

        app.MapGet("/api/validation", async (IScienceServiceClient science, CancellationToken cancellationToken) =>
            Results.Ok(await science.RunValidationAsync(cancellationToken)));

        app.MapPost("/api/archive/spherex/search", async (SpherexArchiveRequest body, IScienceServiceClient science, CancellationToken cancellationToken) =>
            Results.Ok(await science.SearchSpherexAsync(body, cancellationToken)));

        app.MapPost("/api/archive/spherex/analyze", async (SpherexArchiveRequest body, IScienceServiceClient science, CancellationToken cancellationToken) =>
            Results.Ok(await science.AnalyzeSpherexAsync(body, cancellationToken)));

        app.MapPost("/api/archive/spherex/validate", async (SpherexValidationRequest body, IScienceServiceClient science, CancellationToken cancellationToken) =>
            Results.Ok(await science.ValidateSpherexAsync(body, cancellationToken)));

        app.MapPost("/api/archive/spherex/evidence-graph", async (SpherexEvidenceGraphRequest body, IScienceServiceClient science, CancellationToken cancellationToken) =>
            Results.Ok(await science.EvidenceGraphSpherexAsync(body, cancellationToken)));

        app.MapPost("/api/archive/spherex/evidence-graph/jobs", async (SpherexEvidenceGraphRequest body, IScienceServiceClient science, CancellationToken cancellationToken) =>
            Results.Accepted(value: await science.QueueEvidenceGraphSpherexAsync(body, cancellationToken)));

        app.MapGet("/api/archive/spherex/evidence-graph/jobs/{jobId}", async (string jobId, IScienceServiceClient science, CancellationToken cancellationToken) =>
            Results.Ok(await science.GetEvidenceGraphJobAsync(jobId, cancellationToken)));

        app.MapPost("/api/research-feedback", async (ResearchFeedbackRequest body, HttpRequest request, ParallaxDbContext db, CancellationToken cancellationToken) =>
        {
            var signal = body.Signal.Trim().ToLowerInvariant();
            var role = body.Role.Trim().ToLowerInvariant();
            var language = body.Language.Trim().ToLowerInvariant();
            var region = body.Region.Trim().ToLowerInvariant();
            var validRegions = new[] { "unspecified", "south-asia", "north-america", "europe", "latin-america", "africa", "oceania", "other" };
            if (body.Surface.Trim().ToLowerInvariant() != "parallax-x" || signal is not ("useful" or "unclear" or "would-share") || role is not ("student" or "teacher" or "researcher") || language is not ("en" or "bn") || !validRegions.Contains(region))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["signal"] = ["Use a valid signal, role, language, and broad region category."] });
            db.AuditEntries.Add(new AuditEntry
            {
                Id = Guid.NewGuid(),
                Action = "research-feedback",
                ActorKey = DemoUserKey(request),
                EntityType = "ResearchHandoff",
                MetadataJson = JsonSerializer.Serialize(new { surface = "parallax-x", signal, role, language, region, notes = body.Notes?.Trim() }),
                CreatedAtUtc = DateTime.UtcNow,
            });
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(new { signal, recordedAtUtc = DateTime.UtcNow });
        });

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
