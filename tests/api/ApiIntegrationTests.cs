using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Parallax.Api.Contracts;
using Parallax.Api.Data;
using Parallax.Api.Models;
using Parallax.Api.Services;
using Xunit;

namespace Parallax.Api.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection connection = new("Data Source=:memory:");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        connection.Open();
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<ParallaxDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<ParallaxDbContext>>();
            services.AddDbContext<ParallaxDbContext>(options => options.UseSqlite(connection));
            services.RemoveAll<IScienceServiceClient>();
            services.AddSingleton<IScienceServiceClient, FakeScienceServiceClient>();
            using var provider = services.BuildServiceProvider();
            using var scope = provider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ParallaxDbContext>();
            db.Database.EnsureCreated();
            Seed(db);
        });
    }

    private static void Seed(ParallaxDbContext db)
    {
        var source = new DatasetSource { Id = Guid.NewGuid(), Name = "Demo source", DatasetType = "synthetic-demo", Label = "DEMONSTRATION DATASET", SourceIdentifier = "seed-source", CreatedAtUtc = DateTime.UtcNow };
        var run = new ProcessingRun { Id = Guid.NewGuid(), DatasetSource = source, AlgorithmVersion = "test", Status = "completed", StartedAtUtc = DateTime.UtcNow, CompletedAtUtc = DateTime.UtcNow, ParametersJson = "{}", ResultJson = "{\"epochs\":{\"a\":{\"epoch\":\"A\"},\"b\":{\"epoch\":\"B\"}}}" };
        var candidate = new Candidate { Id = Guid.NewGuid(), ProcessingRun = run, CandidateKey = "motion-001", Classification = "apparent_motion", Interpretation = "possible apparent motion; requires additional verification", Status = "candidate", CreatedAtUtc = DateTime.UtcNow };
        candidate.Measurements.Add(new CandidateMeasurement { Id = Guid.NewGuid(), Candidate = candidate, MetricName = "measurement.displacement_pixels_xy", MetadataJson = "[4.5,-3.2]" });
        db.Add(candidate);
        db.SaveChanges();
    }

    public Guid CandidateId
    {
        get
        {
            using var scope = Services.CreateScope();
            return scope.ServiceProvider.GetRequiredService<ParallaxDbContext>().Candidates.OrderBy(x => x.CreatedAtUtc).First().Id;
        }
    }
    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        connection.Dispose();
    }
}

public sealed class FakeScienceServiceClient : IScienceServiceClient
{
    public Task<JsonElement> RunValidationAsync(CancellationToken cancellationToken) => Task.FromResult(JsonSerializer.SerializeToElement(new { summary = new { passed = 5, failed = 0, total = 5 } }));
    public Task<JsonElement> SearchSpherexAsync(SpherexArchiveRequest request, CancellationToken cancellationToken) => Task.FromResult(JsonSerializer.SerializeToElement(new { source = "NASA SPHEREx / IRSA", records = Array.Empty<object>() }));
    public Task<JsonElement> AnalyzeSpherexAsync(SpherexArchiveRequest request, CancellationToken cancellationToken) => Task.FromResult(JsonSerializer.SerializeToElement(new { source = "NASA SPHEREx / IRSA", analysis = new { comparison = new { status = "READY TO COMPARE" } } }));
    public Task<JsonElement> ValidateSpherexAsync(SpherexValidationRequest request, CancellationToken cancellationToken) => Task.FromResult(JsonSerializer.SerializeToElement(new { suite = "SPHEREx live multi-field validation", requested_fields = request.Fields.Count, ready_fields = request.Fields.Count }));
    public Task<JsonElement> EvidenceGraphSpherexAsync(SpherexEvidenceGraphRequest request, CancellationToken cancellationToken) => Task.FromResult(JsonSerializer.SerializeToElement(new { suite = "PARALLAX X SPHEREx Evidence Graph", summary = new { bands_requested = request.Bands?.Count ?? 0, total_candidates = 0 } }));
    public Task<JsonElement> QueueEvidenceGraphSpherexAsync(SpherexEvidenceGraphRequest request, CancellationToken cancellationToken) => Task.FromResult(JsonSerializer.SerializeToElement(new { job_id = "test-job", status = "queued", requested_bands = request.Bands?.Count ?? 0 }));
    public Task<JsonElement> GetEvidenceGraphJobAsync(string jobId, CancellationToken cancellationToken) => Task.FromResult(JsonSerializer.SerializeToElement(new { job_id = jobId, status = "complete", result = new { suite = "PARALLAX X SPHEREx Evidence Graph" } }));

    public Task<ScienceAnalysisResponse> AnalyzeAsync(ScienceProcessRequest request, CancellationToken cancellationToken)
    {
        var epoch = JsonSerializer.SerializeToElement(new { dataset_label = "DEMONSTRATION DATASET", dataset_id = "synthetic-demo", observation_id = "synthetic-epoch-a", epoch = "A", shape = new[] { 128, 128 }, coordinate_frame = "synthetic tangent-plane pixels", pixel_scale_arcsec = 0.4 });
        var epochB = JsonSerializer.SerializeToElement(new { dataset_label = "DEMONSTRATION DATASET", dataset_id = "synthetic-demo", observation_id = "synthetic-epoch-b", epoch = "B", shape = new[] { 128, 128 }, coordinate_frame = "synthetic tangent-plane pixels", pixel_scale_arcsec = 0.4 });
        return Task.FromResult(new ScienceAnalysisResponse
        {
            DatasetLabel = "DEMONSTRATION DATASET",
            Epochs = new Dictionary<string, JsonElement> { ["a"] = epoch, ["b"] = epochB },
            Comparison = new ScienceComparisonAssessment
            {
                Status = "READY TO COMPARE",
                Reasons = ["The observations share compatible dimensions, coordinates, scale, overlap, and bands."],
            },
            Candidates = [new ScienceCandidate { CandidateId = "motion-001", Classification = "apparent_motion", Interpretation = "possible apparent motion; requires additional verification", Measurement = new() { ["displacement_pixels_xy"] = JsonSerializer.SerializeToElement(new[] { 4.5, -3.2 }) }, Quality = new() { ["registration_error"] = JsonSerializer.SerializeToElement(0.04) } }],
            ScreenedCandidates = [
                new ScienceReviewItem { CandidateId = "artifact-001", Classification = "likely_artifact", Status = "screened", Interpretation = "elongated residual; likely artifact; not promoted for citizen-science classification", Measurement = new() { ["shape_ratio"] = JsonSerializer.SerializeToElement(3.4) }, Quality = new() { ["component_snr"] = JsonSerializer.SerializeToElement(12.0) } },
                new ScienceReviewItem { CandidateId = "uncertain-001", Classification = "uncertain", Status = "needs_review", Interpretation = "low-SNR residual; requires additional verification", Measurement = new() { ["position_xy"] = JsonSerializer.SerializeToElement(new[] { 63.0, 106.0 }) }, Quality = new() { ["component_snr"] = JsonSerializer.SerializeToElement(4.2), ["promotion_threshold_sigma"] = JsonSerializer.SerializeToElement(5.0) } },
            ],
            SpectralComparison = [],
        });
    }
}

public class ApiIntegrationTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory factory;

    public ApiIntegrationTests(ApiFactory factory) => this.factory = factory;

    [Fact]
    public async Task Candidate_detail_and_measurements_are_retrievable()
    {
        using var client = factory.CreateClient();
        var id = factory.CandidateId;
        var detail = await client.GetFromJsonAsync<CandidateDetail>($"/api/candidates/{id}");
        var measurements = await client.GetFromJsonAsync<List<MeasurementResponse>>($"/api/candidates/{id}/measurements");
        var spectrum = await client.GetFromJsonAsync<List<SpectrumResponse>>($"/api/candidates/{id}/spectrum");
        var provenance = await client.GetFromJsonAsync<ProvenanceResponse>($"/api/candidates/{id}/provenance");
        Assert.Equal("DEMONSTRATION DATASET", detail!.DatasetLabel);
        Assert.Contains(measurements!, measurement => measurement.MetricName.Contains("displacement", StringComparison.Ordinal));
        Assert.Empty(spectrum!);
        Assert.Equal("seed-source", provenance!.SourceIdentifier);
        Assert.Equal("A", provenance.EpochA.GetProperty("epoch").GetString());
        Assert.Equal("B", provenance.EpochB.GetProperty("epoch").GetString());
    }

    [Fact]
    public async Task Spherex_multi_field_validation_is_proxied()
    {
        using var client = factory.CreateClient();
        var request = new SpherexValidationRequest([
            new SpherexValidationFieldRequest("field-a", 127.69, -39.17),
            new SpherexValidationFieldRequest("field-b", 150.11, 2.20)]);
        var response = await client.PostAsJsonAsync("/api/archive/spherex/validate", request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, payload.GetProperty("requested_fields").GetInt32());
    }

    [Fact]
    public async Task Classification_persists_and_consensus_requires_a_vote()
    {
        using var client = factory.CreateClient();
        var id = factory.CandidateId;
        var before = await client.GetAsync($"/api/candidates/{id}/consensus");
        Assert.Equal(HttpStatusCode.Forbidden, before.StatusCode);
        var post = await client.PostAsJsonAsync("/api/classifications", new ClassificationRequest(id, "moving", "demo review", "HIGH"));
        Assert.Equal(HttpStatusCode.OK, post.StatusCode);
        var saved = await post.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("HIGH", saved.GetProperty("confidence").GetString());
        var after = await client.GetFromJsonAsync<List<ConsensusResponse>>($"/api/candidates/{id}/consensus");
        Assert.Equal("moving", after!.Single().ClassificationLabel);
    }

    [Fact]
    public async Task Passport_updates_after_review_and_learning_module()
    {
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Demo-User", "passport-test-user");
        var id = factory.CandidateId;
        var post = await client.PostAsJsonAsync("/api/classifications", new ClassificationRequest(id, "uncertain", Confidence: "LOW"));
        Assert.Equal(HttpStatusCode.OK, post.StatusCode);

        var passport = await client.GetFromJsonAsync<PassportResponse>("/api/passport");
        Assert.Equal(1, passport!.ObjectsInspected);
        Assert.Equal(1, passport.CandidatesReviewed);
        Assert.Equal(1, passport.ConsensusMatches);
        Assert.Contains(passport.Achievements, achievement => achievement.Key == "first-light");

        var module = await client.PostAsync("/api/passport/modules/uncertainty", content: null);
        Assert.Equal(HttpStatusCode.OK, module.StatusCode);
        var updated = await module.Content.ReadFromJsonAsync<PassportResponse>();
        Assert.Equal(1, updated!.LearningModulesCompleted);
        Assert.Contains("uncertainty", updated.LearningModules);
    }

    [Fact]
    public async Task Demo_analysis_trigger_persists_a_processing_run()
    {
        using var client = factory.CreateClient();
        var firstResponse = await client.PostAsJsonAsync("/api/demo/run-analysis", new DemoRunRequest());
        Assert.True(firstResponse.IsSuccessStatusCode, await firstResponse.Content.ReadAsStringAsync());
        var firstRun = await firstResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("completed", firstRun.GetProperty("status").GetString());
        Assert.Equal(3, firstRun.GetProperty("candidateCount").GetInt32());

        var secondResponse = await client.PostAsJsonAsync("/api/demo/run-analysis", new DemoRunRequest());
        Assert.True(secondResponse.IsSuccessStatusCode, await secondResponse.Content.ReadAsStringAsync());
        var secondRun = await secondResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(firstRun.GetProperty("id").GetGuid(), secondRun.GetProperty("id").GetGuid());

        var comparison = await client.GetFromJsonAsync<ComparisonAssessmentResponse>($"/api/comparisons/{firstRun.GetProperty("id").GetGuid()}");
        Assert.Equal("READY TO COMPARE", comparison!.Status);

        var candidates = await client.GetFromJsonAsync<List<CandidateListItem>>("/api/candidates");
        Assert.Equal(4, candidates!.Count);
        Assert.Contains(candidates!, candidate => candidate.CandidateKey == "PX-DEMO-017" && candidate.Classification == "apparent_motion");
        Assert.Contains(candidates!, candidate => candidate.Classification == "likely_artifact" && candidate.Status == "screened");
        Assert.Contains(candidates!, candidate => candidate.Classification == "uncertain" && candidate.Status == "needs_review");
    }

    [Fact]
    public async Task Swagger_document_is_available()
    {
        using var client = factory.CreateClient();
        var response = await client.GetAsync("/swagger/v1/swagger.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Operational_health_and_metrics_endpoints_are_available()
    {
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
        var ready = await client.GetAsync("/health/ready");
        Assert.Equal(HttpStatusCode.OK, ready.StatusCode);
        Assert.Contains("database", await ready.Content.ReadAsStringAsync());
        var metrics = await client.GetStringAsync("/metrics");
        Assert.Contains("parallax_api_requests_total", metrics);
        var snapshot = await client.GetFromJsonAsync<JsonElement>("/api/ops/metrics");
        Assert.True(snapshot.GetProperty("requests").GetInt64() > 0);
    }

    [Fact]
    public async Task Validation_endpoint_returns_science_report()
    {
        using var client = factory.CreateClient();
        var report = await client.GetFromJsonAsync<JsonElement>("/api/validation");
        Assert.Equal(5, report.GetProperty("summary").GetProperty("passed").GetInt32());
        Assert.Equal(0, report.GetProperty("summary").GetProperty("failed").GetInt32());
    }

    [Fact]
    public async Task Spherex_archive_endpoints_proxy_science_service()
    {
        using var client = factory.CreateClient();
        var request = new SpherexArchiveRequest(127.69, -39.17, Band: "SPHEREx-D3");
        var search = await client.PostAsJsonAsync("/api/archive/spherex/search", request);
        Assert.Equal(HttpStatusCode.OK, search.StatusCode);
        var searchPayload = await search.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("NASA SPHEREx / IRSA", searchPayload.GetProperty("source").GetString());

        var analysis = await client.PostAsJsonAsync("/api/archive/spherex/analyze", request);
        Assert.Equal(HttpStatusCode.OK, analysis.StatusCode);
        var analysisPayload = await analysis.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("READY TO COMPARE", analysisPayload.GetProperty("analysis").GetProperty("comparison").GetProperty("status").GetString());
    }

    [Fact]
    public async Task Spherex_evidence_graph_is_proxied()
    {
        using var client = factory.CreateClient();
        var request = new SpherexEvidenceGraphRequest(127.69, -39.17, Bands: ["SPHEREx-D3", "SPHEREx-D4"]);
        var response = await client.PostAsJsonAsync("/api/archive/spherex/evidence-graph", request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("PARALLAX X SPHEREx Evidence Graph", payload.GetProperty("suite").GetString());
        Assert.Equal(2, payload.GetProperty("summary").GetProperty("bands_requested").GetInt32());
    }

    [Fact]
    public async Task Spherex_evidence_graph_job_lifecycle_is_proxied()
    {
        using var client = factory.CreateClient();
        var request = new SpherexEvidenceGraphRequest(127.69, -39.17, Bands: ["SPHEREx-D3", "SPHEREx-D4"]);
        var queued = await client.PostAsJsonAsync("/api/archive/spherex/evidence-graph/jobs", request);
        Assert.Equal(HttpStatusCode.Accepted, queued.StatusCode);
        var queuedPayload = await queued.Content.ReadFromJsonAsync<JsonElement>();
        var jobId = queuedPayload.GetProperty("job_id").GetString();
        Assert.Equal("queued", queuedPayload.GetProperty("status").GetString());

        var status = await client.GetAsync($"/api/archive/spherex/evidence-graph/jobs/{jobId}");
        Assert.Equal(HttpStatusCode.OK, status.StatusCode);
        var statusPayload = await status.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("complete", statusPayload.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Research_handoff_feedback_is_persisted_and_measurable()
    {
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Demo-User", "pilot:teacher-01");
        var submit = await client.PostAsJsonAsync("/api/research-feedback", new ResearchFeedbackRequest("parallax-x", "useful", "Clear enough for a classroom pilot.", "teacher", "bn", "south-asia"));
        Assert.Equal(HttpStatusCode.OK, submit.StatusCode);

        var metrics = await client.GetFromJsonAsync<ResearchFeedbackMetricsResponse>("/api/research-feedback/metrics");
        Assert.NotNull(metrics);
        Assert.True(metrics!.TotalFeedback >= 1);
        Assert.True(metrics.UniqueParticipants >= 1);
        Assert.Contains(metrics.Roles!, role => role.Label == "teacher");
        Assert.Contains(metrics.Signals, signal => signal.Label == "useful");
        Assert.Contains(metrics.Languages!, language => language.Label == "bn");
        Assert.Contains(metrics.Regions!, region => region.Label == "south-asia");
    }

    [Fact]
    public async Task Public_evidence_bundle_is_readable_without_an_editor_session()
    {
        using var author = factory.CreateClient();
        var created = await author.PostAsJsonAsync("/api/public-evidence-bundles", new PublicEvidenceBundleRequest("Test handoff", JsonSerializer.SerializeToElement(new { status = "reviewable" })));
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var payload = await created.Content.ReadFromJsonAsync<PublicEvidenceBundleCreatedResponse>();
        Assert.NotNull(payload);

        using var publicClient = factory.CreateClient();
        var bundle = await publicClient.GetFromJsonAsync<PublicEvidenceBundleResponse>($"/api/public-evidence-bundles/{payload!.BundleId}");
        Assert.Equal("Test handoff", bundle!.Title);
        Assert.Equal("reviewable", bundle.Payload.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Consensus_report_returns_aggregate_reviewer_evidence()
    {
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Demo-User", "pilot:student-01");
        var submit = await client.PostAsJsonAsync("/api/classifications", new ClassificationRequest(factory.CandidateId, "uncertain", Confidence: "LOW"));
        Assert.Equal(HttpStatusCode.OK, submit.StatusCode);

        var report = await client.GetFromJsonAsync<ConsensusReportResponse>("/api/community/consensus-report");
        Assert.NotNull(report);
        Assert.True(report!.CandidatesReviewed >= 1);
        Assert.Contains(report.Items, item => item.CandidateKey == "motion-001" && item.TotalVotes >= 1);
    }

    [Fact]
    public async Task Classification_rejects_unknown_confidence_without_persisting_it()
    {
        using var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/classifications", new ClassificationRequest(factory.CandidateId, "uncertain", Confidence: "certain"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
